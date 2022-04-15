  /**
   *
   * @param {string} url Адрес
   * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
   * @param {string} type Тип
   * @param {string} responseType Тип ответа: json или blob
   */
export function request(url: string, params: object|string, type:string = 'GET', responseType:string = 'json'): object

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
export function get(table: string, where, expand, fields, sortfields, page, perPage, RemoveDuplicates, format, titles): object

  /**
   * Создать новую запись
   * @param table
   * @param values
   */
export function create(table: string, values: object)

  /**
   * Удалить запись
   * @param table
   * @param id
   */
export function remove(table, id)

  /**
   * Редактировать значения
   * @param table
   * @param ID
   * @param values
   */
export function edit(table, ID, values)

  /**
   * Получить схемы всех таблиц
   */
export function getCRUDInfo(): object

/**
 * Авторизоваться
 * @param username 
 * @param password 
 */
export function auth(username: string, password: string);

/**
 * Зарегистрироваться с этим логином и паролем
 * @param username 
 * @param password 
 */
export function signup(username, password);

/**
 * Выйти из системы
 */
export function logout(): object;
