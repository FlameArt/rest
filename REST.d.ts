/**
 *
 * @param {string} url Адрес
 * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
 * @param {string} type Тип
 * @param {string} responseType Тип ответа: json или blob
 */
export function request(url: string, params: object | string, type: string = 'GET', responseType: string = 'json'): object

/**
 * Получить выборку из таблицы через REST
 * @param table
 * @param fields
 * @param where Позволяет делать выборку из связанных таблиц, надо только их указать через название таблицы sites.id=5, и указать колонку в expand
 * @param expand Устаревшая механика, оставлена для совместимости
 * @param sortfields
 * @param page
 * @param perPage
 * @param RemoveDuplicates
 * @param format
 * @param titles Это чтобы мы могли контроллить какие названия полей мы будет загружать при экспорте, чтобы они были как в таблице
 * @return Promise<object>
 */
export function get(table: string, where: object | string | null, expand: object | string | null, fields: object | Array | string | null, sortfields: object | Array | string | null, page: number, perPage: number, RemoveDuplicates, format, titles): object

/**
 * Получить все записи по запросу [постранично]
 * @param {string} table 
 * @param {object} params 
 * @returns 
 */
export function all(table: string, params: {where: object, fields: object|Array, sort: Array, page: number, perPage: number}): object;

/**
 * Получить одну запись по её ID
 * @param table 
 * @param id 
 * @param fields 
 * @param primaryKeyName 
 */
export function one(table: string, id: number|string, fields: object|Array, primaryKeyName: string): object;

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
export function remove(table: string, id: number | string)

/**
 * Редактировать значения
 * @param table
 * @param ID
 * @param values
 */
export function edit(table: string, ID: number | string, values: object)

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
export function signup(username: string, password: string);

/**
 * Выйти из системы
 */
export function logout(): object;
