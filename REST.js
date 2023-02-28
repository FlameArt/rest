
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
     * Версия api
     */
    this.version = version ? version : 'v1';

  }

  install(Vue, options) {
    window.REST = this;
  }


  /**
   *
   * @param {string} url Адрес
   * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
   * @param {string} type Тип
   * @param {string} responseType Тип ответа: json или blob
   */
  request(url, params, type = 'GET', responseType = 'json') {

    // Нормализуем параметры, если они есть
    if (typeof params === "object") {
      params = JSON.stringify(params);
    }

    let that = this;

    // Фетч поддерживается - получаем через него, это быстрее
    if (typeof fetch === "function") {

      return new Promise(async (resolve, reject) => {

        try {

          // Тело запроса
          let requestBody = {
            method: type,
            mode: 'cors',
            headers: {
              'Content-type': 'application/json; charset=utf-8'
            }
          };

          if (type !== 'GET')
            requestBody.body = params;

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
   * @return Promise<>
   */
  get(table, where, extfields, fields, sortfields, page, perPage, RemoveDuplicates, format, titles, tree) {

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

    if (titles !== undefined && titles !== null)
      json.titles = titles;

    if (sortfields !== undefined && sortfields !== null)
      json.sort = sortfields;

    if (extfields !== undefined && extfields !== null)
      json.extfields = extfields;

    if (RemoveDuplicates !== undefined && RemoveDuplicates !== null)
      json.RemoveDuplicates = true;

    if (format !== undefined && format !== null) {
      json.format = format;
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
    return this.get(table, params?.where, params?.extfields, params?.fields, params?.sort, params?.page, params?.perPage, null, null, null, params?.tree);
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
    await this.prepare(values);

    if (appendTo === undefined) appendTo = null;
    if (insertAfter === undefined) insertAfter = null;
    if (insertFirst === undefined) insertFirst = null;

    return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/create?'
      + (appendTo !== null ? '&appendTo=' + appendTo : '')
      + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
      + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
      , JSON.stringify(values), 'POST');

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
    await this.prepare(values);

    if (appendTo === undefined) appendTo = null;
    if (insertAfter === undefined) insertAfter = null;
    if (insertFirst === undefined) insertFirst = null;

    return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/update?id=' + ID
      + (appendTo !== null ? '&appendTo=' + appendTo : '')
      + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
      + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
      , JSON.stringify(values), 'PATCH');
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

  async auth(username, password) {

    let resp = await this.request(this.SERVER + '/auth/auth', JSON.stringify({ login: username, password: password }), 'POST');

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    return resp.data;

  }

  async signup(email, username, password, name) {

    let resp = await this.request(this.SERVER + '/auth/signup', JSON.stringify({ login: username, email: email, password: password, name: name }), 'POST');

    if (resp.errors) return resp;
    if (resp.data.length === 0) { resp.errors = []; return resp; }

    return resp.data;

  }

  logout() {
    return this.request(this.SERVER + '/auth/logout', '{}', 'POST');
  }


  /**
   * Подготовить объект под загрузку: загрузить данные из элементов Input [type=file] / Clipboard / DataTransfer [Drag&Drop/Clipboard]
   * @param {object} values 
   */
  async prepare(values) {

    // Если в один из параметров передан FileList или input[type=file], т.е. нужно загрузить файлы
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
          for (let file in value) {
            newValues.push({
              'name': value[file].name,
              'data': await this.readFileAsync(value[file]),
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
            values[val].splice(valueKey);
            values[val].push(...newValues);
          }
          else {
            values[val] = newValues;
          }


        }
      }
    }

    return values;

  }

  /**
   * Прочесть файл асинхронно
   * @param {File} file 
   * @returns {Promise<string>}
   */
  readFileAsync(file) {
    return new Promise((resolve, reject) => {
      let reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result);
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
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


}


if (!window.REST) {
  window.REST = new FLAMEREST();
}

export default window.REST;