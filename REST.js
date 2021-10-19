
export default class FLAMEREST {

  constructor(server_address, localhost_endpoint, unauthorized_callback){

    /**
     * Адрес серва
     * @type {string}
     */
    if(typeof window === 'undefined' && server_address === undefined) this.SERVER = "http://localhost/";
    if(typeof window !== 'undefined' && server_address === undefined) this.SERVER = window.location.protocol + "//" + window.location.host;
    if(server_address !== undefined) this.SERVER = server_address;
    this.SERVER = this.SERVER.substr(this.SERVER.length-2, 1) === '/' ? this.SERVER.substr(0,this.SERVER.length-1) : this.SERVER;

    if(typeof window !== 'undefined' && window.location.hostname === 'localhost' && localhost_endpoint !== undefined) this.SERVER = localhost_endpoint;

    /**
     * Стандартное число запросов на страницу
     * @type {number}
     */
    this.perPageDefault = 20;

    /**
     * Будет вызван, если любой из запросов вернут требование авторизоваться
     */
    this.unauthorized_callback = unauthorized_callback;

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
    if(typeof fetch === "function") {

      return new Promise(async (resolve,reject)=>{

        // Тело ответа формируется в два этапа: сперва заголовки, затем ответ
        let ResolveBody = {};

        // Тело запроса
        let requestBody = {
          method: type,
          mode: 'cors',
          headers: {
            'Content-type': 'application/json; charset=utf-8'
          }
        };

        if(type!=='GET')
          requestBody.body = params;

        // Делаем запрос
        fetch(url, requestBody)
        .then(response=>{

          // Ответ получен

          // Ответ с ошибкой
          if (!response.ok) {

            // Тело ошибки
            let error_body = null;
            try {
              error_body = response.json();
            }
            catch (exjson){
              error_body = response.text();
            }

            console.log('Ошибка загрузки [' + response.status + '] ' + url + ": " + response.statusText);

            throw {
              status: response.status,
              message: response.statusText,
              body: error_body
            }

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
          ResolveBody = {
            status: response.status,
            type: "json",
            data: {},
            pages: pages
          };

          // Получаем тело ответа
          switch (responseType) {
            case 'json': return response.text();
            case 'blob': {
              // Записываем имя файла и mime-тип
              ResolveBody.filename = 'file'; //response.headers.get('content-disposition').split('filename=')[1];
              ResolveBody.MimeType = response.headers.get('content-Type');
              return response.blob();
            }
          }

        }).then(response=>{

          // Декодируем тело ответа, если оно есть
          if(response===undefined) throw "ERR";
          if(response==="") response = "{}";

          // Если ответ в виде блоба, сразу его отдаём без декодировки
          if(responseType === 'blob') {
            ResolveBody.data = response;
            resolve(ResolveBody);
            return;
          }

          try {
            response = JSON.parse(response);
          } catch (ex) {
            throw "ERR";
          }

          // Если пришёл ответ: неавторизовано, и указан коллбек авторизации - запускаем его
          if(response.Auth === false) {
            if(that.unauthorized_callback !== undefined) {that.unauthorized_callback(); resolve(response); return;}
          }

          // Возвращаем успешную загрузку
          ResolveBody.data = response;
          resolve(ResolveBody);

        }).catch(err=>{

          // Ошибка загрузки любого типа
          // TODO: на этом этапе стоит сделать, чтобы он пробовал повторить запрос, если это GET

          if(typeof err !== 'object' || err.message === undefined) {
            err = {
              status: 0,
              message: '',
            };
          }

          console.log('Ошибка загрузки [' + 0 + '] ' + url + ": " + err.message);

          reject(err);

        })

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
   * @return Promise<>
   */
  get(table, where, expand, fields, sortfields, page, perPage, RemoveDuplicates, format, titles) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g,"");

    let responseType = "json";

    // Генерим запрос
    let query = this.SERVER + '/api/' + table;

    let json = {};

    // Генерим условия
    if(where!==undefined && where!==null)
      json.where = where;

    if(fields !== undefined && fields!==null)
      json.fields = fields;

    if(titles !== undefined && titles!==null)
      json.titles = titles;

    if(sortfields !== undefined && sortfields!==null)
      json.sort = sortfields;

    if(expand !== undefined && expand!==null)
      json.expand = expand;

    if(RemoveDuplicates !== undefined && RemoveDuplicates!==null)
      json.RemoveDuplicates = true;

    if(format !== undefined && format!==null) {
      json.format = format;
      responseType = "blob";
    }



    // Страницы
    json['per-page'] = perPage === undefined ? this.perPageDefault : perPage;
    json['page'] = page === undefined ? 1 : page;

    return this.request(query, JSON.stringify(json), 'POST', responseType);

  }

  /**
   * Создать новую запись
   * @param table
   * @param values
   */
  create(table, values) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g,"");

    return this.request(this.SERVER + '/api/' + table + '/create', JSON.stringify(values), 'POST');

  }

  /**
   * Удалить запись
   * @param table
   * @param id
   */
  remove(table, id) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g,"");

    return this.request(this.SERVER + '/api/' + table + '/delete?id=' + id , '{}', 'DELETE');

  }

  /**
   * Редактировать значения
   * @param table
   * @param ID
   * @param values
   */
  edit(table, ID, values) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g,"");

    return this.request(this.SERVER + '/api/' + table + '/update?id=' + ID, JSON.stringify(values), 'PATCH');
  }

  /**
   * Получить схемы всех таблиц
   */
  getCRUDInfo() {
    if(window.sessionStorage.getItem("crudschema") === null) {
      return this.request(this.SERVER + '/site/crudschema', {}, 'GET')
          .then(res => {
            // Кешируем схему в браузере на время текущей сессии (в пределах ОДНОЙ вкладки)
            window.sessionStorage.setItem("crudschema", JSON.stringify(res));
            return res;
          });
    }
    else
      return new Promise((resolve,reject)=>{ resolve(JSON.parse(window.sessionStorage.getItem("crudschema")))});
  }

  auth(username, password) {
    return this.request(this.SERVER + '/auth/auth', JSON.stringify({login: username, password: password}), 'POST');
  }

  logout() {
    return this.request(this.SERVER + '/auth/logout', '{}', 'POST');
  }

}
