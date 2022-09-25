/**
 *
 * @param {string} url Адрес
 * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
 * @param {string} type Тип
 * @param {string} responseType Тип ответа: json или blob
 */
export function request(url: string, params: object | string, type?: string, responseType?: string): object

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
export function get<T>(table: string, where?: object | string | null, extfields?: object | Array<string>, fields?: object | Array<string> | string | null, sortfields?: object | Array<string> | string | null, page?: number, perPage?: number, RemoveDuplicates?, format?, titles?): Promise<Rows<T>>;

/**
 * Получить все записи по запросу [постранично]
 * @param {string} table 
 * @param {object} params 
 * @returns 
 */
export function all<T>(table: string, params?: { where?: object, extfields?: object | Array<string>, fields?: object | Array<string>, sort?: Array<string>, page?: number, perPage?: number, tree?: number }): Promise<Rows<T>>;

/**
 * Стандартный ответ от Request с несколькими строками
 */
type Rows<T> = {
  type: string,
  status: number,
  ok: boolean,
  data?: Array<T>,
  errors: object | undefined,
  message: string | undefined,
  pages: {
    page: number,
    perPage: number,
    count: number,
    total: number,
  }
}

/**
   * Получить одну запись по ID или по условию выборки [первая запись]
   * @param {string} table 
   * @param {number|string|object} IDOrWhere 
   * @param {object|Array} fields 
   * @param {string} primaryKeyName если указан ID, то указать название первичного ключа, если от id он отличается
 */
export function one<T>(table: string, IDOrWhere: number | string | object, extfields?: object | Array<string>, fields?: object | Array<string> | null, primaryKeyName?: string): Promise<T | null>;

/**
 * Создать новую запись
 * @param table
 * @param values
 */
export function create<T>(table: string, values: object, appendTo?: number | string | null, insertAfter?: number | string | null, insertFirst?: number | string | null): Promise<SavedObject<T>>

/**
 * Удалить запись
 * @param table
 * @param id
 * @param byFields Если указан, удаляет по этим параметрам
 */
export function remove(table: string, id: number | string, byFields?: object): Promise<boolean | Array<any>>

/**
 * Редактировать значения
 * @param table
 * @param ID
 * @param values
 */
export function edit<T>(table: string, ID: number | string, values: object, appendTo: number | string | null, insertAfter: number | string | null, insertFirst: number | string | null): Promise<SavedObject<T>>


/**
 * Стандартный ответ от Request с изменённой строкой
 */
type SavedObject<T> = {
  type: string,
  status: Number,
  ok: boolean,
  data?: T,
  errors: Object | undefined,
  message: string | undefined,
}

/**
 * Получить схемы всех таблиц
 */
export function getCRUDInfo(): object

/**
 * Авторизоваться
 * @param username 
 * @param password 
 */
export function auth(username?: string, password?: string): Promise<Authorized>;

/**
 * Зарегистрироваться с этим логином и паролем
 * @param email 
 * @param username 
 * @param password 
 * @param name 
 */
export function signup(email: string | null, username: string | null, password: string, name: string | null): Promise<Authorized>;

/**
 * Результат авторизации
 */
type Authorized = {
  isAuthorized: boolean;
  User: {
    avatar: string,
    country: string,
    id: number,
    lang: string,
    name: string,
    role: string
  };
  errors: { [key: string]: any };
}

/**
 * Выйти из системы
 */
export function logout(): Promise<object>;

/**
 * Подготовить объект под загрузку: загрузить данные из элементов [type=file]
 * Работает ссылочно, меняя основной массив
 * @param values 
 */
export function prepare(values: any): Promise<any>;


/**
 * Заполнить объект данными, пришедшими из базы, сохраняя оригинальные классы и функции
 * @param object Заполняемый объект
 * @param values Аналогичный объект-источник данных
 */
export function fillObject(object: any, values: any): void;