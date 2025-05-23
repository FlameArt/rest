
class FLAMEREST {

  constructor(server_address, localhost_endpoint, unauthorized_callback, version) {

    /**
     * Адрес серва
     * @type {string}
     */
    if (typeof window === 'undefined' && server_address === undefined) this.SERVER = "http://localhost/";
    if (typeof window !== 'undefined' && server_address === undefined) this.SERVER = window.location.protocol + "//" + window.location.host;
    if (server_address !== undefined) this.SERVER = server_address;
    this.SERVER = this.SERVER.substr(this.SERVER.length - 2, 1) === '/' ? this.SERVER.substr(0, this.SERVER.length - 1) : this.SERVER;

    if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && localhost_endpoint !== undefined) this.SERVER = localhost_endpoint;

    /**
     * Стандартное число запросов на страницу
     * @type {number}
     */
    this.perPageDefault = 20;

    /**
     * Будет вызван, если любой из запросов вернут требование авторизоваться
     */
    this.unauthorized_callback = unauthorized_callback;

    /**
     * Токен приложения конкретного клиента для отправки пуш уведомлений именно ему
     */
    this.pushNotificationToken = null;

    /**
     * Версия api
     */
    this.version = version ? version : 'v1';

    /**
     * Если авторизация по токену, то он сюда подставляется
     */
    this.isAuthByJWTQuery = true;

    /**
     * Режим авторизации: Bearer|Link
     */
    this.authMode = "Bearer";

    this.token = null;

  }

  install(Vue, options) {
    window.REST = this;
  }


  /**
   *
   * @param {string} url Адрес
   * @param {object|string|FormData} params Параметры, которые надо передать, могут быть в виде объекта или строки
   * @param {string} type Тип
   * @param {string} responseType Тип ответа: json или blob
   * @param {Object} customHeaders объект с доп заголовками, которые надо включить в запрос
   */
  request(url, params, type = 'GET', responseType = 'json', isNeedToken = true, customHeaders = {}) {

    // Нормализуем параметры, если они есть
    if (typeof params === "object" && params !== null) {

      if (!(params instanceof FormData))
        params = JSON.stringify(params);

      if (type === 'GET')
        type = 'POST';
      
      responseType = 'json';

    }


    // Подставляем сервер автоматом в запрос начинающийся с /
    if (url[0] === '/' && url[1] !== '/') url = this.SERVER + url;

    let that = this;

    // Фетч поддерживается - получаем через него, это быстрее
    if (typeof fetch === "function") {

      return new Promise(async (resolve, reject) => {

        try {

          // Авторизация
          if (this.isAuthByJWTQuery && isNeedToken === true && this.token !== null && this.token !== undefined && this.token !== 'undefined') {
            switch (this.authMode) {
              case 'Link':
                url = url + (url.indexOf("?") === -1 ? "?" : "&") + "access-token=" + this.token;
              default:
                Object.assign(customHeaders, { 'Authorization': 'Bearer ' + this.token })
            }
          }

          // Уникальный user_hash
          let user_hash = localStorage.getItem('user_hash');
          if (user_hash) {
            Object.assign(customHeaders, { udata: user_hash });
          }

          // Тело запроса
          let requestBody = {
            method: type,
            mode: 'cors',
            headers: Object.assign(
              (params instanceof FormData ? {} : {
                'Content-type': 'application/json; charset=utf-8'
              }), customHeaders)
          };

          if (type !== 'GET')
            // Принимает и formData тоже и чистую json строку
            requestBody.body = params;

          // Создаём подпись каждого запроса
          let SIGN = "empty";
          try {
            SIGN = await this.hmac_sha256(requestBody.body, user_hash);
          }
          catch (ex) {
            // window.alert('Can`t create a request');
            // throw ex;
          }

          requestBody.headers['sign'] = SIGN;

          // Делаем запрос
          let response = await fetch(url, requestBody);

          // Тело ответа формируется в два этапа: сперва заголовки, затем ответ
          let ResolveBody = {
            status: response.status,
            ok: response.ok
          };

          // Ответ с ошибкой
          if (!response.ok) {

            // Тело ошибки
            ResolveBody.message = response.statusText;

            try {

              ResolveBody.errors = await response.json();

              // Ошибки
              switch (ResolveBody.status) {

                // Ошибка валидации: Собираем все ошибки полей
                case 422:
                  let Errs = {};
                  for (let err of ResolveBody.errors) {
                    Errs[err['field']] = Errs[err['field']] === undefined ? err['message'] : Errs[err['field']] + ". " + err['message']
                  }
                  ResolveBody.errors = Errs;
                  break;
                case 401:
                  if (typeof this.unauthorized_callback === 'function') {
                    this.unauthorized_callback();
                  }
                  break;
              }

            }
            catch (exjson) {
              ResolveBody.errors = await response.text();
            }

            // Рапортуем об ошибке
            console.error('Ошибка загрузки [' + response.status + '] ' + url + ": " + response.statusText, ResolveBody, ResolveBody.errors);

            // Возвращаем управление, которое работает без блока catch, достаточно проверить на if(response.errors)
            resolve(ResolveBody);
            return;

          }

          // Загрузка успешна

          // Если в заголовках указана паджинация
          let pages = undefined;
          if (response.headers.get('X-Pagination-Current-Page') !== null) {
            pages = {
              page: parseInt(response.headers.get('X-Pagination-Current-Page')),
              perPage: parseInt(response.headers.get('X-Pagination-Per-Page')),
              count: parseInt(response.headers.get('X-Pagination-Page-Count')),
              total: parseInt(response.headers.get('X-Pagination-Total-Count')),
            }
          }



          // Заполняем тело ответа заголовками
          ResolveBody.type = "json";
          ResolveBody.data = {};
          ResolveBody.pages = pages;

          // Получаем тело ответа
          switch (responseType) {
            case 'json': ResolveBody.data = await response.text(); break;
            case 'blob': {
              // Записываем имя файла и mime-тип
              ResolveBody.filename = 'file'; //response.headers.get('content-disposition').split('filename=')[1];
              ResolveBody.MimeType = response.headers.get('content-Type');
              ResolveBody.data = await response.blob();

              // Если ответ в виде блоба, сразу его отдаём без декодировки
              resolve(ResolveBody);
              return;
            }
          }

          // Декодируем тело ответа, если оно есть
          if (ResolveBody.data === undefined) {
            ResolveBody.errors = ["Принятый ответ пуст"];
            console.error("Принятый ответ пуст", ResolveBody);
            resolve(ResolveBody);
            return;
          };

          // Пустой ответ конвертируем в валидный пустой объект
          if (ResolveBody.data === "") ResolveBody.data = "{}";

          // Декодируем
          try {
            ResolveBody.data = JSON.parse(ResolveBody.data);
          } catch (ex) {
            ResolveBody.errors = ["Ошибка декодирования"];
            console.error("Ошибка декодирования", ResolveBody);
            reject(ResolveBody);
            return;
          }

          // Декодинг успешен

          // Если пришёл ответ: неавторизовано, и указан коллбек авторизации - запускаем его
          if (response.Auth === false) {
            if (that.unauthorized_callback !== undefined) { that.unauthorized_callback(); resolve(response); return; }
          }


          // Возвращаем успешную загрузку
          resolve(ResolveBody);

          return;

        }

        catch (err) {

          // Ошибка загрузки любого типа
          // TODO: на этом этапе стоит сделать, чтобы он пробовал повторить запрос, если это GET

          if (typeof err !== 'object' || err.message === undefined) {
            err = {
              status: 0,
              message: '',
            };
          }

          if (typeof err.body === 'object') {
            err.body = await err.body;
          }

          console.log('Ошибка загрузки [' + 0 + '] ' + url + ": " + err.message);

          reject(err);

        }

      });

    }


    // Фетч не поддерживается - возвращаем промисифицированный XHR
    else {

      return new Promise((resolve, reject) => {

        // Генерим новый запрос
        let xhr = new XMLHttpRequest();
        xhr.open(type, url, true);

        // Автоматический парсинг json ответа
        xhr.responseType = 'json';

        // Запрос тоже в json
        xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');

        // Запрос между доменами свободный, если это dev-среда
        xhr.withCredentials = false;

        // Отправляем запрос
        xhr.send(params === undefined ? null : params);

        xhr.onload = function () {

          // Ошибка загрузки
          if (xhr.status !== 200) {
            console.log('Ошибка загрузки [' + xhr.status + '] ' + url + ": " + xhr.statusText);
            return reject({
              status: xhr.status,
              message: xhr.statusText
            });
          }

          // Загрузка успешна

          // Если в заголовках указана паджинация
          let pages = undefined;
          if (xhr.getResponseHeader('X-Pagination-Current-Page') !== null) {
            pages = {
              page: parseInt(xhr.getResponseHeader('X-Pagination-Current-Page')),
              perPage: parseInt(xhr.getResponseHeader('X-Pagination-Per-Page')),
              count: parseInt(xhr.getResponseHeader('X-Pagination-Page-Count')),
              total: parseInt(xhr.getResponseHeader('X-Pagination-Total-Count')),
            }
          }


          return resolve({
            status: xhr.status,
            type: xhr.responseType,
            data: xhr.response,
            pages: pages
          });
        };

        // Ошибка загрузки, не связанная с ХТТП, например обрыв соединения
        // TODO: на этом этапе стоит сделать, чтобы он пробовал повторить запрос, если это GET
        xhr.onerror = function () {
          console.log('Ошибка загрузки [' + 0 + '] ' + url + ": Нет соединения с сервером");
          return reject({
            status: 0,
            message: "Нет соединения с сервером"
          });
        };

      });

    }

  }

  /**
   * Получить выборку из таблицы через REST
   * @param table
   * @param fields
   * @param where Позволяет делать выборку из связанных таблиц, надо только их указать через название таблицы sites.id=5, и указать колонку в expand
   * @param expand
   * @param sortfields
   * @param page
   * @param perPage
   * @param RemoveDuplicates
   * @param format
   * @param titles Это чтобы мы могли контроллить какие названия полей мы будет загружать при экспорте, чтобы они были как в таблице
   * @param tree дерево
   * @param params Доп параметры для кастомизации запроса на беке
   * @param exportData имя файла для экспорта
   * @return Promise<>
   */
  get(table, where, extfields, fields, sortfields, page, perPage, RemoveDuplicates, format, titles, tree, params, exportData) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g, "");

    let responseType = "json";

    // Генерим запрос
    let query = this.SERVER + '/api/' + this.version + '/' + table;

    let json = {};

    // Генерим условия
    if (where !== undefined && where !== null)
      json.where = where;

    // Генерим условия
    if (tree !== undefined && tree !== null)
      json.tree = tree;

    if (fields !== undefined && fields !== null)
      json.fields = fields;

    if (sortfields !== undefined && sortfields !== null)
      json.sort = sortfields;

    if (extfields !== undefined && extfields !== null)
      json.extfields = extfields;

    if (params !== undefined && params !== null)
      json.params = params;

    if (RemoveDuplicates !== undefined && RemoveDuplicates !== null)
      json.RemoveDuplicates = true;

    if (titles !== undefined && titles !== null)
      json.titles = titles;

    // экспорт
    if (exportData !== undefined && exportData !== null) {
      json.export = {
        format: exportData.format ?? 'xlsx',
        titles: exportData.titles ?? [],
        filename: exportData.filename ?? 'export_' + Date.now() + ".xlsx",
      };
      responseType = "blob";
    }

    // Страницы
    json['per-page'] = perPage === undefined ? this.perPageDefault : perPage;
    json['page'] = page === undefined ? 1 : page;

    return this.request(query, JSON.stringify(json), 'POST', responseType);

  }

  /**
   * Получить все записи по запросу [постранично]
   * @param {string} table 
   * @param {object} params 
   * @returns {object}
   */
  all(table, params) {
    return this.get(table, params?.where, params?.extfields, params?.fields, params?.sort, params?.page, params?.perPage, null, null, null, params?.tree, params?.params, params?.export);
  }

  /**
   * Получить одну запись по ID или по условию выборки [первая запись]
   * @param {string} table 
   * @param {number|string|object} IDOrWhere 
   * @param {object|Array} fields 
   * @param {string} primaryKeyName 
   * @returns {object|null}
   */
  async one(table, IDOrWhere, extfields = null, fields = null, primaryKeyName = 'id') {

    let where = {};
    if (typeof IDOrWhere === 'string' || typeof IDOrWhere === 'number') where = { [primaryKeyName]: IDOrWhere };
    else if (typeof IDOrWhere === 'object') where = IDOrWhere;
    else throw "Нужно передавать ID или объект";

    let resp = await this.get(table, where, extfields, fields, null, 1, 1);
    if (resp.errors) return resp;
    if (resp.data.length === 0) return null;

    return resp.data[0];
  }

  /**
   * Создать новую запись
   * @param table
   * @param values
   */
  async create(table, values, appendTo = null, insertAfter = null, insertFirst = null) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g, "");

    // Подготовить значения
    if (!(values instanceof FormData))
      await this.prepare(values);

    if (appendTo === undefined) appendTo = null;
    if (insertAfter === undefined) insertAfter = null;
    if (insertFirst === undefined) insertFirst = null;

    return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/create?'
      + (appendTo !== null ? '&appendTo=' + appendTo : '')
      + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
      + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
      , (values instanceof FormData ? values : JSON.stringify(values)), 'POST');

  }

  /**
   * Удалить запись
   * @param table
   * @param id
   * @param byFields
   */
  async remove(table, id = 0, byFields = null) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g, "");

    let params = {};
    if (byFields instanceof Object) params = byFields;

    let resp = await this.request(this.SERVER + '/api/' + this.version + '/' + table + '/delete?id=' + id, JSON.stringify(params), 'DELETE');

    if (resp.status === 204) return true;

    return resp;

  }

  /**
   * Редактировать значения
   * @param table
   * @param ID
   * @param values
   */
  async edit(table, ID, values, appendTo = null, insertAfter = null, insertFirst = null) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g, "");

    // Подготовить значения
    if (!(values instanceof FormData))
      await this.prepare(values);

    if (appendTo === undefined) appendTo = null;
    if (insertAfter === undefined) insertAfter = null;
    if (insertFirst === undefined) insertFirst = null;

    return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/update?id=' + ID
      + (appendTo !== null ? '&appendTo=' + appendTo : '')
      + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
      + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
      , (values instanceof FormData ? values : JSON.stringify(values)), 'POST');
  }

  /**
   * Получить схемы всех таблиц
   */
  getCRUDInfo() {
    if (window.sessionStorage.getItem("crudschema") === null) {
      return this.request(this.SERVER + '/site/crudschema', {}, 'GET')
        .then(res => {
          // Кешируем схему в браузере на время текущей сессии (в пределах ОДНОЙ вкладки)
          window.sessionStorage.setItem("crudschema", JSON.stringify(res));
          return res;
        });
    }
    else
      return new Promise((resolve, reject) => { resolve(JSON.parse(window.sessionStorage.getItem("crudschema"))) });
  }

  async auth(username, password, pushNotificationToken) {

    let resp = null;
    if (this.token !== null && this.token !== undefined && this.token !== 'undefined' && (username === null || username === undefined)) {
      resp = await this.request(this.SERVER + '/auth/auth', JSON.stringify({}), 'POST', 'json', true);
    }
    else {
      resp = await this.request(this.SERVER + '/auth/auth', JSON.stringify({ login: username, password: password, pushNotificationToken: (pushNotificationToken ?? this.pushNotificationToken ?? null) }), 'POST', 'json', false);
    }

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    // после успешной авторизации устанавливаем токен
    if (typeof resp.token === 'string') this.token = resp.token;

    // Сохраняем хеш юзера автоматически
    let user_hash = localStorage.getItem('user_hash');

    // Не трогаем хранилище при каждом запросе, только если нужно переустановить хеш [авторизация на др. устройстве]
    if (resp?.data?.User?.user_hash && resp.data.User.user_hash !== user_hash) {
      localStorage.setItem('user_hash', resp.data.User.user_hash);
    }

    return resp.data;

  }

  async signup(email, username, password, name, pushNotificationToken, data = null) {

    let resp = await this.request(this.SERVER + '/auth/signup', JSON.stringify({ login: username, email: email, password: password, name: name, data: data, pushNotificationToken: (pushNotificationToken ?? this.pushNotificationToken ?? null) }), 'POST', 'json', false);

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    // после успешной авторизации устанавливаем токен
    if (typeof resp.token === 'string') this.token = resp.token;

    return resp.data;

  }

  logout() {
    return this.request(this.SERVER + '/auth/logout', '{}', 'POST');
  }

  /**
   * Восстановление пароля
   * Запрос на восстановление пароля
   * @param {*} email 
   * @returns 
   */
  async ResetPasswordRequest(email) {

    let resp = await this.request(this.SERVER + '/auth/resetpasswordrequest', JSON.stringify({ email: email }), 'POST', 'json', false);

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    return resp.data;

  }

  /**
   * Восстановление пароля
   * Проверка токена восстановления
   * @param {*} token токен подтверждения
   * @returns 
   */
  async ResetPasswordTokenCheck(token) {

    let resp = await this.request(this.SERVER + '/auth/resettokencheck', JSON.stringify({ token: token }), 'POST', 'json', false);

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    return resp.data;

  }

  /**
   * Восстановление пароля
   * Сохранение нового пароля
   * @param {*} token 
   * @param {*} password 
   * @returns 
   */
  async ResetPasswordSaveNewPassword(token, password) {

    let resp = await this.request(this.SERVER + '/auth/resetconfirm', JSON.stringify({ token: token, password: password }), 'POST', 'json', false);

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    return resp.data;

  }


  /**
   * Подготовить объект под загрузку: загрузить данные из элементов Input [type=file] / Clipboard / DataTransfer [Drag&Drop/Clipboard]
   * @param {object} values 
   */
  async prepare(values, asFormData = false) {

    // Если в один из параметров передан FileList или input[type=file], т.е. нужно загрузить файлы

    const formData = new FormData();

    for (let val in values) {

      // Пустые значения нам не нужны
      if (values[val] === undefined || values[val] === null) continue;

      // Любой вариант захода делаем массивом
      let valuesArr = [];
      if (values[val] instanceof Array) valuesArr = values[val];
      else valuesArr = [values[val]];

      // Идём по каждому значению в массиве
      for (let valueKey in valuesArr) {

        let value = valuesArr[valueKey];

        // Преобразуем
        let isRef = false;
        if (value instanceof Object
          && value.hasOwnProperty('_value')
          && (
            value._value instanceof Event ||
            value._value instanceof HTMLInputElement ||
            value._value instanceof ClipboardEvent ||
            value._value instanceof DataTransfer ||
            value._value instanceof FileList
          )
        ) { value = value.value; isRef = true }

        if (value instanceof Event && value.target instanceof HTMLInputElement && value.target.type === 'file') value = value.target.files;
        if (value instanceof HTMLInputElement && value.type === 'file') value = value.files;
        if (value instanceof ClipboardEvent) value = value.clipboardData.files;
        if (value instanceof DataTransfer) value = value.files;
        if (value instanceof FileList) {
          let newValues = [];
          value = Array.from(value);
          for (let index = 0; index < value.length; index++) {
            formData.append(val + "[]", value[index])
            newValues.push({
              'name': value[index].name,
              'data': asFormData ? null : await this.readFileAsync(value[index]),
              'number': index, // Здесь индекс
              'id': this.generateID(32)
            });
          }

          /*
          if (isRef)
            values[val].value = newValues;
          else
            values[val] = newValues;
            */

          if (values[val] instanceof Array) {
            values[val].splice(valueKey, 1);
            values[val].push(...newValues);
          }
          else {
            values[val] = newValues;
          }

        }
      }
    }

    formData.append("json", JSON.stringify(values));

    return asFormData ? formData : values;

  }

  /**
   * Прочесть файл асинхронно
   * @param {File} file 
   * @param {'data' | 'text'} readAs
   * @returns {Promise<string>}
   */
  readFileAsync(file, readAs = 'data') {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result);
      };

      reader.onerror = reject;

      if (readAs === 'data')
        reader.readAsDataURL(file);
      if (readAs === 'text')
        reader.readAsText(file);

    })
  }

  /**
   * Заполнить существующий объект пришедшими из БД данными
   * сохраняя при этом оригинальные классы и функции
   * @param {*} object 
   * @param {*} values 
   */
  fillObject(object, values) {
    for (let prop in object) {

      // добавляем только те объекты, что уже созданы в сущности
      if (!values.hasOwnProperty(prop)) continue;

      // объекты проходим рекурсивно
      if (typeof values[prop] === 'object' && typeof object[prop] === 'object' && values[prop] !== null && object[prop] !== null) { this.fillObject(object[prop], values[prop]); continue }

      // тут остались все обычные типы - записываем
      object[prop] = values[prop];

    }
    return object;
  }

  generateID(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  /**
   * 
   * @param {string} data
   * @param {string} key
   * @returns 
   */
  async hmac_sha256(message, secret_key) {

    if (!(typeof message === 'string') && !(typeof secret_key === 'string'))
      throw new TypeError('Expected string input data.')

    const enc = new TextEncoder();
    const encodedKey = enc.encode(secret_key);
    const encodedMessage = enc.encode(message);

    const data = encodedMessage;
    const key = encodedKey;

    if (!(data instanceof Uint8Array) && !(key instanceof Uint8Array))
      throw new TypeError('Expected Uint8Array input data.')


    if (typeof window === 'undefined' && typeof Deno === 'undefined') {
      const { createHmac } = await import('crypto')
      return Uint8Array.from([...createHmac('SHA256', key).update(data).digest()])
    } else {

      if (typeof window.crypto.subtle === 'undefined') throw "Can`t create hash";

      return window.crypto.subtle
        .importKey(
          'raw',
          key,
          { name: 'HMAC', hash: { name: 'SHA-256' } },
          false,
          ['sign', 'verify']
        )
        .then(key => window.crypto.subtle.sign('HMAC', key, data))
        .then(signature => {

          // Преобразование ArrayBuffer в Uint8Array
          const signatureArray = new Uint8Array(signature);

          // Преобразование Uint8Array в строку в формате Hex
          const hexString = Array.from(signatureArray)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');

          return hexString;

        })
    }
  }



}


if (!window.REST) {
  window.REST = new FLAMEREST();
}

export default window.REST;