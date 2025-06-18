import { createHmac } from 'crypto';

/**
 * Базовый ответ от сервера
 */
export type BaseResponse<T> = {
    type: string,
    status: number,
    ok: boolean,
    data?: T,
    errors: object | undefined,
    message: string | undefined,
}

/**
 * Часть ответа с пагинацией
 */
export type Paginated = {
    pages: {
        page: number,
        perPage: number,
        count: number,
        total: number,
    }
}

/**
 * Стандартный ответ от Request с несколькими строками
 */
export type Rows<T> = BaseResponse<Array<T>> & Paginated;

export type Row<T> = BaseResponse<T> & Paginated;

export type CustomRequest<T> = BaseResponse<T>;

export type CustomAnyRequest = BaseResponse<any>;


/**
 * Стандартный ответ от Request с изменённой строкой
 */
export type SavedObject<T> = BaseResponse<T>;

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
        role: string,
        user_hash?: string
    };
    errors: { [key: string]: any };
    token: string;
}

export class FLAMEREST {

    /**
     * Адрес серва
     */
    public SERVER: string;

    /**
     * Стандартное число запросов на страницу
     */
    public perPageDefault: number = 20;

    /**
     * Будет вызван, если любой из запросов вернут требование авторизоваться
     */
    public unauthorized_callback: (() => void) | undefined;

    /**
     * Токен приложения конкретного клиента для отправки пуш уведомлений именно ему
     */
    public pushNotificationToken: string | null = null;

    /**
     * Версия api
     */
    public version: string;

    /**
     * Если авторизация по токену, то он сюда подставляется
     */
    public isAuthByJWTQuery: boolean = true;

    /**
     * Режим авторизации: Bearer|Link
     */
    public authMode: "Bearer" | "Link" = "Bearer";

    public token: string | null = null;


    constructor(server_address?: string, localhost_endpoint?: string, unauthorized_callback?: () => void, version?: string) {
        if (typeof window === 'undefined') {
            // SSR: используем предоставленный адрес или дефолтный
            this.SERVER = server_address ?? "http://localhost/";
        } else {
            // Client: определяем адрес по window.location или из параметра
            if (server_address === undefined) {
                this.SERVER = window.location.protocol + "//" + window.location.host;
            } else {
                this.SERVER = server_address;
            }

            if (window.location.hostname === 'localhost' && localhost_endpoint !== undefined) {
                this.SERVER = localhost_endpoint;
            }
        }

        // Убираем слэш в конце, если он есть
        this.SERVER = this.SERVER.endsWith('/') ? this.SERVER.substring(0, this.SERVER.length - 1) : this.SERVER;

        this.unauthorized_callback = unauthorized_callback;
        this.version = version ?? 'v1';
    }

    /**
     * Установка плагина для Vue
     * @param Vue 
     * @param options 
     */
    install(Vue: any, options: any) {
        if (typeof window !== 'undefined') {
            (window as any).REST = this;
        }
    }

    /**
     *
     * @param {string} url Адрес
     * @param {object|string|FormData} params Параметры, которые надо передать, могут быть в виде объекта или строки
     * @param {string} type Тип
     * @param {string} responseType Тип ответа: json или blob
     * @param {boolean} isNeedToken нужен ли токен для запроса
     * @param {Object} customHeaders объект с доп заголовками, которые надо включить в запрос
     */
    request(url: string, params: object | string | FormData, type: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', responseType: 'json' | 'blob' = 'json', isNeedToken = true, customHeaders: Record<string, string> = {}): Promise<BaseResponse<any> & Partial<Paginated>> {

        // Нормализуем параметры, если они есть
        if (typeof params === "object" && params !== null) {
            if (!(params instanceof FormData)) {
                params = JSON.stringify(params);
            }

            if (type === 'GET') {
                type = 'POST';
            }
            responseType = 'json';
        }

        // Подставляем сервер автоматом в запрос начинающийся с /
        if (url[0] === '/' && url[1] !== '/') {
            url = this.SERVER + url;
        }

        const that = this;

        // Фетч поддерживается - получаем через него, это быстрее
        if (typeof fetch === "function") {
            return new Promise(async (resolve, reject) => {
                try {
                    // Авторизация
                    if (this.isAuthByJWTQuery && isNeedToken === true && this.token !== null && this.token !== undefined && this.token !== 'undefined') {
                        switch (this.authMode) {
                            case 'Link':
                                url = url + (url.indexOf("?") === -1 ? "?" : "&") + "access-token=" + this.token;
                                break;
                            default:
                                Object.assign(customHeaders, { 'Authorization': 'Bearer ' + this.token });
                                break;
                        }
                    }

                    // Уникальный user_hash (только на клиенте)
                    let user_hash: string | null = null;
                    if (typeof window !== 'undefined' && window.localStorage) {
                        user_hash = window.localStorage.getItem('user_hash');
                        if (user_hash) {
                            Object.assign(customHeaders, { udata: user_hash });
                        }
                    }

                    // Тело запроса
                    const headers: Record<string, string> = { ...customHeaders };
                    if (!(params instanceof FormData)) {
                        headers['Content-type'] = 'application/json; charset=utf-8';
                    }

                    const requestBody: RequestInit = {
                        method: type,
                        mode: 'cors',
                        headers: headers
                    };

                    if (type !== 'GET') {
                        // Принимает и formData тоже и чистую json строку
                        requestBody.body = params;
                    }

                    // Создаём подпись каждого запроса
                    let SIGN = "empty";
                    try {
                        // Используем user_hash для подписи, если он есть
                        SIGN = await this.hmac_sha256(requestBody.body, user_hash ?? "");
                    } catch (ex) {
                        // console.error('Can`t create a request sign');
                    }
                    (requestBody.headers as any)['sign'] = SIGN;

                    // Делаем запрос
                    const response = await fetch(url, requestBody);

                    // Тело ответа формируется в два этапа: сперва заголовки, затем ответ
                    const ResolveBody: any = {
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
                                    const Errs: { [key: string]: string } = {};
                                    for (const err of ResolveBody.errors) {
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
                        } catch (exjson) {
                            ResolveBody.errors = await response.text();
                        }

                        // Рапортуем об ошибке
                        console.error('Ошибка загрузки [' + response.status + '] ' + url + ": " + response.statusText, ResolveBody, ResolveBody.errors);
                        resolve(ResolveBody);
                        return;
                    }

                    // Загрузка успешна
                    // Если в заголовках указана паджинация
                    let pages: Paginated['pages'] | undefined = undefined;
                    if (response.headers.get('X-Pagination-Current-Page') !== null) {
                        pages = {
                            page: parseInt(response.headers.get('X-Pagination-Current-Page')!),
                            perPage: parseInt(response.headers.get('X-Pagination-Per-Page')!),
                            count: parseInt(response.headers.get('X-Pagination-Page-Count')!),
                            total: parseInt(response.headers.get('X-Pagination-Total-Count')!),
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
                            ResolveBody.filename = 'file'; // TODO: response.headers.get('content-disposition').split('filename=')[1];
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

                    // Если пришёл ответ: неавторизовано, и указан коллбек авторизации - запускаем его
                    if ((ResolveBody.data as any).Auth === false) {
                        if (that.unauthorized_callback !== undefined) { that.unauthorized_callback(); resolve(ResolveBody); return; }
                    }

                    // Возвращаем успешную загрузку
                    resolve(ResolveBody);

                } catch (err: any) {
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
                    console.error('Ошибка загрузки [' + 0 + '] ' + url + ": " + err.message);
                    reject(err);
                }
            });
        }
        else {
            // Фетч не поддерживается (старые браузеры или окружения) - возвращаем промисифицированный XHR
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(type, url, true);
                xhr.responseType = 'json';
                xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');
                xhr.withCredentials = false;
                xhr.send(params as any);

                xhr.onload = function () {
                    if (xhr.status !== 200) {
                        console.error('Ошибка загрузки [' + xhr.status + '] ' + url + ": " + xhr.statusText);
                        return reject({
                            status: xhr.status,
                            message: xhr.statusText
                        });
                    }

                    let pages: Paginated['pages'] | undefined = undefined;
                    if (xhr.getResponseHeader('X-Pagination-Current-Page') !== null) {
                        pages = {
                            page: parseInt(xhr.getResponseHeader('X-Pagination-Current-Page')!),
                            perPage: parseInt(xhr.getResponseHeader('X-Pagination-Per-Page')!),
                            count: parseInt(xhr.getResponseHeader('X-Pagination-Page-Count')!),
                            total: parseInt(xhr.getResponseHeader('X-Pagination-Total-Count')!),
                        }
                    }

                    return resolve({
                        status: xhr.status,
                        type: xhr.responseType,
                        data: xhr.response,
                        pages: pages,
                        ok: true,
                        errors: undefined,
                        message: ''
                    });
                };

                xhr.onerror = function () {
                    console.error('Ошибка загрузки [' + 0 + '] ' + url + ": Нет соединения с сервером");
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
     * @param {string} table
     * @param {object | string | null} where Позволяет делать выборку из связанных таблиц, надо только их указать через название таблицы sites.id=5, и указать колонку в expand
     * @param {object | Array<string> | null} extfields
     * @param {object | Array<string> | string | null} fields
     * @param {object | Array<string> | string | null} sortfields
     * @param {number | undefined} page
     * @param {number | undefined} perPage
     * @param {boolean | undefined} RemoveDuplicates
     * @param {any} titles Это чтобы мы могли контроллить какие названия полей мы будет загружать при экспорте, чтобы они были как в таблице
     * @param {any} tree дерево
     * @param {any} params Доп параметры для кастомизации запроса на беке
     * @param {any} exportData имя файла для экспорта
     * @return Promise<Rows<T>>
     */
    get<T>(table: string, where?: object | string | null, extfields?: object | Array<string> | null, fields?: object | Array<string> | string | null, sortfields?: object | Array<string> | string | null, page?: number, perPage?: number, RemoveDuplicates?: boolean, format?: any, titles?: any, tree?: any, params?: any, exportData?: any): Promise<Rows<T>> {
        // Нормализуем имена таблиц
        table = table.replace(/_/g, "");
        let responseType: 'json' | 'blob' = "json";
        // Генерим запрос
        const query = this.SERVER + '/api/' + this.version + '/' + table;
        const json: any = {};
        // Генерим условия
        if (where !== undefined && where !== null) json.where = where;
        if (tree !== undefined && tree !== null) json.tree = tree;
        if (fields !== undefined && fields !== null) json.fields = fields;
        if (sortfields !== undefined && sortfields !== null) json.sort = sortfields;
        if (extfields !== undefined && extfields !== null) json.extfields = extfields;
        if (params !== undefined && params !== null) json.params = params;
        if (RemoveDuplicates !== undefined && RemoveDuplicates !== null) json.RemoveDuplicates = true;
        if (titles !== undefined && titles !== null) json.titles = titles;
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
        return this.request(query, JSON.stringify(json), 'POST', responseType) as Promise<Rows<T>>;
    }


    /**
     * Получить все записи по запросу [постранично]
     * @param {string} table
     * @param {object} params
     * @returns {Promise<Rows<T>>}
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
    }): Promise<Rows<T>> {
        return this.get(table, params?.where, params?.extfields, params?.fields, params?.sort, params?.page, params?.perPage, undefined, undefined, undefined, params?.tree, params?.params, params?.export);
    }

    /**
       * Получить одну запись по ID или по условию выборки [первая запись]
       * @param {string} table
       * @param {number|string|object} IDOrWhere
       * @param {object|Array} extfields
       * @param {object|Array} fields
       * @param {string} primaryKeyName если указан ID, то указать название первичного ключа, если от id он отличается
     */
    async one<T>(table: string, IDOrWhere: number | string | object, extfields: object | Array<string> | null = null, fields: object | Array<string> | null = null, primaryKeyName: string = 'id'): Promise<T | null> {
        let where: object = {};
        if (typeof IDOrWhere === 'string' || typeof IDOrWhere === 'number') where = { [primaryKeyName]: IDOrWhere };
        else if (typeof IDOrWhere === 'object') where = IDOrWhere;
        else throw new Error("Нужно передавать ID или объект");

        const resp = await this.get<T>(table, where, extfields, fields, null, 1, 1);
        if (resp.errors) return Promise.reject(resp);
        if (!resp.data || resp.data.length === 0) return null;

        return resp.data[0];
    }

    /**
     * Создать новую запись
     * @param {string} table
     * @param {object} values
     * @param {number|string|null} appendTo
     * @param {number|string|null} insertAfter
     * @param {boolean|null} insertFirst
     */
    async create<T>(table: string, values: object, appendTo: number | string | null = null, insertAfter: number | string | null = null, insertFirst: boolean | null = null): Promise<SavedObject<T>> {
        // Нормализуем имена таблиц
        table = table.replace(/_/g, "");
        // Подготовить значения
        if (!(values instanceof FormData)) {
            await this.prepare(values);
        }

        return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/create?'
            + (appendTo !== null ? '&appendTo=' + appendTo : '')
            + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
            + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
            , (values instanceof FormData ? values : JSON.stringify(values)), 'POST') as Promise<SavedObject<T>>;
    }

    /**
     * Удалить запись
     * @param {string} table
     * @param {number|string} id
     * @param {object|null} byFields Если указан, удаляет по этим параметрам
     */
    async remove(table: string, id: number | string = 0, byFields: object | null = null): Promise<boolean | any> {
        // Нормализуем имена таблиц
        table = table.replace(/_/g, "");
        let params = {};
        if (byFields instanceof Object) params = byFields;
        const resp = await this.request(this.SERVER + '/api/' + this.version + '/' + table + '/delete?id=' + id, JSON.stringify(params), 'DELETE');
        if (resp.status === 204) return true;
        return resp;
    }

    /**
     * Редактировать значения
     * @param {string} table
     * @param {number|string} ID
     * @param {object} values
     * @param {number|string|null} appendTo
     * @param {number|string|null} insertAfter
     * @param {boolean|null} insertFirst
     */
    async edit<T>(table: string, ID: number | string, values: object, appendTo: number | string | null = null, insertAfter: number | string | null = null, insertFirst: boolean | null = null): Promise<SavedObject<T>> {
        // Нормализуем имена таблиц
        table = table.replace(/_/g, "");
        // Подготовить значения
        if (!(values instanceof FormData)) {
            await this.prepare(values);
        }
        return this.request(this.SERVER + '/api/' + this.version + '/' + table + '/update?id=' + ID
            + (appendTo !== null ? '&appendTo=' + appendTo : '')
            + (insertAfter !== null ? '&insertAfter=' + insertAfter : '')
            + (insertFirst !== null ? '&insertFirst=' + insertFirst : '')
            , (values instanceof FormData ? values : JSON.stringify(values)), 'POST') as Promise<SavedObject<T>>;
    }

    /**
     * Получить схемы всех таблиц
     */
    getCRUDInfo(): Promise<object> {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const cachedSchema = window.sessionStorage.getItem("crudschema");
            if (cachedSchema) {
                return new Promise((resolve) => { resolve(JSON.parse(cachedSchema)) });
            }
        }
        return this.request(this.SERVER + '/site/crudschema', {}, 'GET')
            .then(res => {
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    // Кешируем схему в браузере на время текущей сессии (в пределах ОДНОЙ вкладки)
                    window.sessionStorage.setItem("crudschema", JSON.stringify(res));
                }
                return res;
            });
    }

    /**
     * Авторизоваться
     * @param {string|undefined} username 
     * @param {string|undefined} password 
     * @param {object|string|null} pushNotificationToken
     */
    async auth(username?: string, password?: string, pushNotificationToken?: object | string | null): Promise<Authorized> {
        let resp: BaseResponse<Authorized>;
        if (this.token && !username) {
            resp = await this.request(this.SERVER + '/auth/auth', JSON.stringify({}), 'POST', 'json', true);
        } else {
            resp = await this.request(this.SERVER + '/auth/auth', JSON.stringify({ login: username, password: password, pushNotificationToken: (pushNotificationToken ?? this.pushNotificationToken ?? null) }), 'POST', 'json', false);
        }

        if (resp.errors || !resp.data) {
            return Promise.reject(resp.errors ?? new Error("No data received"));
        }

        // после успешной авторизации устанавливаем токен
        if (typeof resp.data.token === 'string') this.token = resp.data.token;

        // Сохраняем хеш юзера автоматически (только на клиенте)
        if (typeof window !== 'undefined' && window.localStorage) {
            const user_hash = window.localStorage.getItem('user_hash');
            if (resp?.data?.User?.user_hash && resp.data.User.user_hash !== user_hash) {
                window.localStorage.setItem('user_hash', resp.data.User.user_hash);
            }
        }
        return resp.data;
    }

    /**
     * Зарегистрироваться с этим логином и паролем
     * @param {string|null} email 
     * @param {string|null} username 
     * @param {string} password 
     * @param {string|null} name 
     * @param {object|string|null} pushNotificationToken
     * @param {any} data
     */
    async signup(email: string | null, username: string | null, password: string, name: string | null = null, pushNotificationToken: object | string | null = null, data: any = null): Promise<Authorized> {
        const resp = await this.request(this.SERVER + '/auth/signup', JSON.stringify({
            login: username, email: email, password: password,
            name: name, data: data, pushNotificationToken: (pushNotificationToken ?? this.pushNotificationToken ?? null)
        }), 'POST', 'json', false);

        if (resp.errors || !resp.data) {
            return Promise.reject(resp.errors ?? new Error("No data received"));
        }

        // после успешной авторизации устанавливаем токен
        if (typeof resp.data.token === 'string') this.token = resp.data.token;

        return resp.data;
    }

    /**
     * Выйти из системы
     */
    logout(): Promise<object> {
        return this.request(this.SERVER + '/auth/logout', '{}', 'POST');
    }

    /**
     * Восстановление пароля
     * Запрос на восстановление пароля
     * @param {*} email
     * @returns
     */
    async ResetPasswordRequest(email: string): Promise<any> {
        const resp = await this.request(this.SERVER + '/auth/resetpasswordrequest', JSON.stringify({ email: email }), 'POST', 'json', false);
        if (resp.errors || !resp.data) return Promise.reject(resp.errors ?? new Error("No data received"));
        return resp.data;
    }

    /**
     * Восстановление пароля
     * Проверка токена восстановления
     * @param {*} token токен подтверждения
     * @returns
     */
    async ResetPasswordTokenCheck(token: string): Promise<any> {
        const resp = await this.request(this.SERVER + '/auth/resettokencheck', JSON.stringify({ token: token }), 'POST', 'json', false);
        if (resp.errors || !resp.data) return Promise.reject(resp.errors ?? new Error("No data received"));
        return resp.data;
    }

    /**
     * Восстановление пароля
     * Сохранение нового пароля
     * @param {*} token
     * @param {*} password
     * @returns
     */
    async ResetPasswordSaveNewPassword(token: string, password: string): Promise<any> {
        const resp = await this.request(this.SERVER + '/auth/resetconfirm', JSON.stringify({ token: token, password: password }), 'POST', 'json', false);
        if (resp.errors || !resp.data) return Promise.reject(resp.errors ?? new Error("No data received"));
        return resp.data;
    }

    /**
     * Подготовить объект под загрузку: загрузить данные из элементов Input [type=file] / Clipboard / DataTransfer [Drag&Drop/Clipboard]
     * @param {object} values
     */
    async prepare(values: { [key: string]: any }, asFormData = false): Promise<any> {

        // В SSR этот метод не будет обрабатывать файлы, т.к. DOM и File API недоступны.
        if (typeof window === 'undefined') {
            return values;
        }

        // Если в один из параметров передан FileList или input[type=file], т.е. нужно загрузить файлы
        const formData = new FormData();

        for (let val in values) {
            // Пустые значения нам не нужны
            if (values[val] === undefined || values[val] === null) continue;

            // Любой вариант захода делаем массивом
            let valuesArr: any[] = Array.isArray(values[val]) ? values[val] : [values[val]];

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
                if (value instanceof ClipboardEvent) value = value.clipboardData?.files;
                if (value instanceof DataTransfer) value = value.files;

                if (value instanceof FileList) {
                    const newValues: any[] = [];
                    const files = Array.from(value);
                    for (let index = 0; index < files.length; index++) {
                        formData.append(val + "[]", files[index]);
                        newValues.push({
                            'name': files[index].name,
                            'data': asFormData ? null : await this.readFileAsync(files[index]),
                            'number': index,
                            'id': this.generateID(32)
                        });
                    }

                    if (Array.isArray(values[val])) {
                        values[val].splice(parseInt(valueKey), 1, ...newValues);
                    } else {
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
    readFileAsync(file: File, readAs: 'data' | 'text' = 'data'): Promise<string | ArrayBuffer | null> {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onloadend = () => { resolve(reader.result); };
            reader.onerror = reject;

            if (readAs === 'data') reader.readAsDataURL(file);
            if (readAs === 'text') reader.readAsText(file);
        });
    }

    /**
     * Заполнить существующий объект пришедшими из БД данными
     * сохраняя при этом оригинальные классы и функции
     * @param {*} object
     * @param {*} values
     */
    fillObject<T extends object>(object: T, values: any): T {
        for (let prop in object) {
            if (!values.hasOwnProperty(prop)) continue;
            if (typeof values[prop] === 'object' && typeof (object as any)[prop] === 'object' && values[prop] !== null && (object as any)[prop] !== null) {
                this.fillObject((object as any)[prop], values[prop]);
                continue;
            }
            (object as any)[prop] = values[prop];
        }
        return object;
    }

    generateID(length: number): string {
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
    async hmac_sha256(message: BodyInit | null | undefined, secret_key: string): Promise<string> {

        if (message === null || message === undefined) message = "";
        if (typeof message !== 'string') message = JSON.stringify(message);

        const enc = new TextEncoder();
        const encodedKey = enc.encode(secret_key);
        const encodedMessage = enc.encode(message);

        const data = encodedMessage;
        const key = encodedKey;

        if (typeof window === 'undefined') {
            const hash = createHmac('sha256', key).update(data).digest('hex');
            return Promise.resolve(hash);
        } else {

            if (typeof window.crypto?.subtle === 'undefined') throw new Error("Can`t create hash");

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
                    const signatureArray = new Uint8Array(signature);
                    return Array.from(signatureArray)
                        .map(byte => byte.toString(16).padStart(2, '0'))
                        .join('');
                });
        }
    }
}


/**
 * Экземпляр-синглтон класса FLAMEREST.
 * Используйте его для всех запросов в приложении.
 * `import REST from './REST.ts';`
 */
const REST = new FLAMEREST();

if (typeof window !== 'undefined') {
    (window as any).REST = REST;
}

export default REST; 