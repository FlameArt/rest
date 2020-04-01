
export default class FLAMEREST {
  
  constructor(server_address){
    
    /**
     * Адрес серва
     * @type {string}
     */
    this.SERVER = server_address === undefined ? "http://localhost/" : server_address;
    this.SERVER = this.SERVER.substr(this.SERVER.length-2, 1) === '/' ? this.SERVER.substr(0,this.SERVER.length-1) : this.SERVER;
    
    /**
     * Стандартное число запросов на страницу
     * @type {number}
     */
    this.perPageDefault = 20;
    
  }
  
  /**
   *
   * @param {string} url Адрес
   * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
   * @param {string} type Тип
   */
  request(url, params, type = 'GET') {
    
    // Нормализуем параметры, если они есть
    if (typeof params === "object") {
      params = JSON.stringify(params);
    }
    
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
            console.log('Ошибка загрузки [' + response.status + '] ' + url + ": " + response.statusText);
            reject({
              status: response.status,
              message: response.statusText
            });
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
          ResolveBody = {
            status: response.status,
            type: "json",
            data: {},
            pages: pages
          };
  
  
          // Получаем тело ответа
          return response.text();
          
          
        }).then(response=>{
  
          // Декодируем тело ответа, если оно есть
          if(response===undefined) throw "ERR";
          if(response==="") response = "{}";
  
          try {
            response = JSON.parse(response);
          } catch (ex) {
            throw "ERR";
          }
  
          // Возвращаем успешную загрузку
          ResolveBody.data = response;
          resolve(ResolveBody);
          
        }).catch(err=>{
          
          // Ошибка загрузки, не связанная с ХТТП, например обрыв соединения
          // TODO: на этом этапе стоит сделать, чтобы он пробовал повторить запрос, если это GET
  
          console.log('Ошибка загрузки [' + 0 + '] ' + url + ": " + err.message);
          reject({
            status: 0,
            message: err.message
          });
          
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
   * @return Promise<>
   */
  get(table, where, expand, fields, sortfields, page, perPage, RemoveDuplicates) {

    // Нормализуем имена таблиц
    table = table.replace(/_/g,"");

    // Генерим запрос
    let query = this.SERVER + '/api/' + table;
    
    let json = {};
    
    // Генерим условия
    if(where!==undefined && where!==null)
      json.where = where;
    
    if(fields !== undefined && fields!==null)
      json.fields = fields;
    
    if(sortfields !== undefined && sortfields!==null)
      json.sort = sortfields;
  
    if(expand !== undefined && expand!==null)
      json.expand = expand;
    
    if(RemoveDuplicates !== undefined && RemoveDuplicates!==null)
      json.RemoveDuplicates = true;
    
    
  
    // Страницы
    json['per-page'] = perPage === undefined ? this.perPageDefault : perPage;
    json['page'] = page === undefined ? 1 : page;
    
    return this.request(query, JSON.stringify(json), 'POST');
    
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
    return this.request(this.SERVER + '/site/crudschema', {}, 'GET');
  }
  
  
}