interface IREST {

  /**
   * Сервер, endpoint
   */
  SERVER: string,

  /**
   * Версия api
   */
  version: string,

  /**
   * Если авторизация по токену
   */
  isAuthByJWTQuery: boolean,

  /**
   * Токен авторизации
   */
  token: string | null,

  /**
   * Будет вызван, если любой из запросов вернут требование авторизоваться
   */
  unauthorized_callback: () => {},

  /**
   * Токен приложения конкретного клиента для отправки пуш уведомлений именно ему
   */
  pushNotificationToken: string | null;


  /**
   * Стандартное число запросов на страницу
   * @type {number}
   */
  perPageDefault: number,

  /**
   *
   * @param {string} url Адрес
   * @param {object|string} params Параметры, которые надо передать, могут быть в виде объекта или строки
   * @param {string} type Тип
   * @param {string} responseType Тип ответа: json или blob
   * @param {Object} customHeaders объект с доп заголовками, которые надо включить в запрос
   */
  request(url: string, params: object | string, type?: string, responseType?: 'json' | 'blob', isNeedToken?: boolean, customHeaders?: object): Promise<object>,

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
  get<T>(table: string, where?: object | string | null, extfields?: object | Array<string>, fields?: object | Array<string> | string | null, sortfields?: object | Array<string> | string | null, page?: number, perPage?: number, RemoveDuplicates?, format?, titles?): Promise<Rows<T>>,

  /**
   * Получить все записи по запросу [постранично]
   * @param {string} table 
   * @param {object} params 
   * @returns 
   */
  all<T>(table: string, params?: {
    where?: object,
    extfields?: object | Array<string>,
    fields?: object | Array<string>,
    sort?: Array<string>,
    page?: number,
    perPage?: number,
    tree?: number,
    params?: any,
    export?: {
      format?: 'xlsx' | 'csv',
      titles?: Array<string>,
      filename?: string,
    }
  }): Promise<Rows<T>>,

  /**
     * Получить одну запись по ID или по условию выборки [первая запись]
     * @param {string} table 
     * @param {number|string|object} IDOrWhere 
     * @param {object|Array} fields 
     * @param {string} primaryKeyName если указан ID, то указать название первичного ключа, если от id он отличается
   */
  one<T>(table: string, IDOrWhere: number | string | object, extfields?: object | Array<string>, fields?: object | Array<string> | null, primaryKeyName?: string): Promise<T | null>,

  /**
   * Создать новую запись
   * @param table
   * @param values
   */
  create<T>(table: string, values: object, appendTo?: number | string | null, insertAfter?: number | string | null, insertFirst?: number | string | null): Promise<SavedObject<T>>,

  /**
   * Удалить запись
   * @param table
   * @param id
   * @param byFields Если указан, удаляет по этим параметрам
   */
  remove(table: string, id: number | string, byFields?: object): Promise<boolean | Array<any>>,

  /**
   * Редактировать значения
   * @param table
   * @param ID
   * @param values
   */
  edit<T>(table: string, ID: number | string, values: object, appendTo: number | string | null, insertAfter: number | string | null, insertFirst: number | string | null): Promise<SavedObject<T>>,


  /**
   * Получить схемы всех таблиц
   */
  getCRUDInfo(): object,

  /**
   * Авторизоваться
   * @param username 
   * @param password 
   */
  auth(username?: string, password?: string, pushNotificationToken?: object | null): Promise<Authorized>,

  /**
   * Зарегистрироваться с этим логином и паролем
   * @param email 
   * @param username 
   * @param password 
   * @param name 
   */
  signup(email: string | null, username: string | null, password: string, name: string | null, pushNotificationToken: object | null): Promise<Authorized>,


  /**
   * Выйти из системы
   */
  logout(): Promise<object>,


  /**
   * Восстановление пароля
   * Запрос на восстановление пароля
   * @param {*} email 
   * @returns 
   */
  ResetPasswordRequest(email: string): Promise<any>,

  /**
   * Восстановление пароля
   * Проверка токена восстановления
   * @param {*} token токен подтверждения
   * @returns 
   */
  ResetPasswordTokenCheck(token: string): Promise<any>,

  /**
   * Восстановление пароля
   * Сохранение нового пароля
   * @param {*} token 
   * @param {*} password 
   * @returns 
   */
  ResetPasswordSaveNewPassword(token: string, password: string): Promise<any>,

  /**
   * Подготовить объект под загрузку: загрузить данные из элементов [type=file]
   * Работает ссылочно, меняя основной массив
   * @param values 
   */
  prepare(values: any): Promise<any>,


  /**
   * Заполнить объект данными, пришедшими из базы, сохраняя оригинальные классы и функции
   * @param object Заполняемый объект
   * @param values Аналогичный объект-источник данных
   */
  fillObject<T>(object: T, values: any): T,

  /**
   * Прочесть файл асинхронно
   * @param {File} file 
   * @param {'data' | 'text'} readAs
   * @returns {Promise<string>}
   */
  readFileAsync(file: File, readAs: 'data' | 'text'): Promise<string>

}


/**
 * Стандартный ответ от Request с несколькими строками
 */
export type Rows<T> = {
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

export type Row<T> = {
  type: string,
  status: number,
  ok: boolean,
  data?: T,
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
 * Стандартный ответ от Request с изменённой строкой
 */
export type SavedObject<T> = {
  type: string,
  status: Number,
  ok: boolean,
  data?: T,
  errors: Object | undefined,
  message: string | undefined,
}

/**
 * Результат авторизации
 */
export type Authorized = {
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
  token: string;
}

declare const REST: IREST;

export default REST;