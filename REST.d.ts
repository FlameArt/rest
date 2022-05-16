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
export function get<T>(table: string, where?: object | string | null, expand?: object | string | null, fields?: object | Array<string> | string | null, sortfields?: object | Array<string> | string | null, page?: number, perPage?: number, RemoveDuplicates?, format?, titles?): Promise<Rows<T>>;

/**
 * Получить все записи по запросу [постранично]
 * @param {string} table 
 * @param {object} params 
 * @returns 
 */
export function all<T>(table: string, params?: { where?: object, fields?: object | Array<string>, sort?: Array<string>, page?: number, perPage?: number }): Promise<Rows<T>>;

/**
 * Стандартный ответ от Request с несколькими строками
 */
type Rows<T> = {
  type: string,
  status: Number,
  ok: boolean,
  data?: Array<T>,
  errors: Object|undefined,
  message: string|undefined,
  pages: {
    page: Number,
    perPage: Number,
    count: Number,
    total: Number,
  }
}

/**
   * Получить одну запись по ID или по условию выборки [первая запись]
   * @param {string} table 
   * @param {number|string|object} IDOrWhere 
   * @param {object|Array} fields 
   * @param {string} primaryKeyName если указан ID, то указать название первичного ключа, если от id он отличается
 */
export function one<T>(table: string, IDOrWhere: number | string | object, fields?: object | Array<string> | null, primaryKeyName?: string): Promise<T | null>;

/**
 * Создать новую запись
 * @param table
 * @param values
 */
export function create<T>(table: string, values: object): Promise<SavedObject<T>>

/**
 * Удалить запись
 * @param table
 * @param id
 * @param byFields Если указан, удаляет по этим параметрам
 */
export function remove(table: string, id: number | string, byFields?: object): Promise<boolean|Array<any>>

/**
 * Редактировать значения
 * @param table
 * @param ID
 * @param values
 */
export function edit<T>(table: string, ID: number | string, values: object): Promise<SavedObject<T>>


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
 * @param username 
 * @param password 
 */
export function signup(username: string, password: string): Promise<Authorized>;

/**
 * Результат авторизации
 */
type Authorized = {
  isAuthorized: boolean;
  User: {
    avatar: string,
    country: string,
    id: Number,
    lang: string,
    name: string,
    role: string
  };
  errors: { [key: string]: any };
}

/**
 * Выйти из системы
 */
export function logout(): object;

/**
 * Подготовить объект под загрузку: загрузить данные из элементов [type=file]
 * Работает ссылочно, меняя основной массив
 * @param values 
 */
export function prepare(values: any): Promise<any>;

