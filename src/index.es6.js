"use strict";

let url = require('url');
let pc = require('punycode');
let endec = require('urlencode');
let assert = require('assert');
let validator = require('validator');

/**
 * @constructor
 */
function UrlManipulate() {
    url.Url.call(this);

	// инициализация обёрток
    this._urlNotations = [
        {name: 'protocol', after: '//'},
        {name: 'auth'},
        {name: 'hostname'},
        {name: 'port', before: ':'},
        {name: 'pathname'},
        {name: 'hash'},
        {name: 'query', before: '?'}
    ];
}

UrlManipulate.prototype = Object.create(url.Url.prototype);
UrlManipulate.constructor = UrlManipulate;

/**
 * Ошибка
 * @param message
 * @param cause
 * @constructor
 */
function UrlError(message, cause) {
    Error.call(this);
}
UrlError.prototype = Object.create(Error.prototype);
UrlError.constructor = UrlError;

/**
 *  Проверяем принадлежат ли две ссылки одному домену
 * @param {string} url1
 * @param {string} url2
 * @returns {boolean}
 */
UrlManipulate.prototype.isSameHost = function(url1, url2, cutWWW) {
	cutWWW = cutWWW == undefined ? true : cutWWW;

	// обрабатываем url
    if (!this.isValid(url1) || !this.isValid(url2)) {
        throw new UrlError('Invalid url');
    }

	return this.getHostname(url1, true, cutWWW) == this.getHostname(url2, true, cutWWW);
}

/**
 * Проверка валидности Url-а. Обёртка над valid-url
 * @param {string} url url
 * @return {boolean} результат
 */
UrlManipulate.prototype.isValid = function(uri) {
	return validator.isURL(uri);

}

/**
 * Приводим ссылку в закодированный вид
 *
 * @param {string} uri исходная ссылка
 * @return {string} обработанная ссылка
 */
UrlManipulate.prototype.encode = function(uri) {
	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

    // декодируем
    let decoded = this.decode(uri);

    // ссылка не кодированная, так что кодируем
    if (decoded == uri) {
        // разбираем ссылку
        let parsed = this.parseUrl(uri);

		['pathname', 'query', 'hash'].forEach(function(part) {
			if (!parsed[part]) {
				return;
			}

			parsed[part] = parsed[part].split('/').map(function(val) {
				return endec.encode(val);
			}).join('/');
		});

		uri = this.buildUrl(parsed);
    }

	return uri;
}

/**
 * Приводим ссылку в human-readable вид
 * @param uri исходная ссылка
 * @return {string|undefined} обработанная ссылка
 */
UrlManipulate.prototype.decode = function(uri) {
	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

	// сначала просто декодируем строчки
	uri = endec.decode(uri);
	// разбиваем
	let parsed = this.parseUrl(uri);
	// обновляем host
	parsed.hostname = this.getHostname(uri, true);

	return this.buildUrl(parsed);
}

/**
 * Конвертируем в пуникод
 * @param {string} uri исходный url
 * @returns {String} конвертированный url
 */
UrlManipulate.prototype.toPunycode = function(uri) {
	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

	return pc.toASCII(uri);
}

/**
 * Конвертируем из пуникода
 * @param {string} uri исходный url
 * @returns {String} конвертированный url
 */
UrlManipulate.prototype.fromPunycode = function(uri) {
	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

	return pc.toUnicode(uri);
}

/**
 * Получаем hostname из url-а с учётом punycode
 *
 * @param {string} uri исходный url
 * @param {boolean} decode нужно ли декодировать
 * @returns {string|void} hostname
 */
UrlManipulate.prototype.getHostname = function(uri, decode, cutWww) {
    decode = decode === undefined ? false : decode;
	cutWww = cutWww === undefined ? true : cutWww;

	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

	let host = this.parseUrl(uri).hostname;

	if (!host) {
		return undefined;
	}

	if (cutWww) {
		host = host.replace(/^www\./, '');
	}

	return decode ? pc.toUnicode(host) : host;
}



/**
 * Парсим url. обёртка над url.parse
 *
 * @param {string} uri исходный
 * @return  {Object} распаршенный url
 */
UrlManipulate.prototype.parseUrl = function(uri) {
	if (!this.isValid(uri)) {
		throw new UrlError('Invalid url');
	}

    return this.parse(this.addHttp(uri));
}

/**
 * Убираем из ссылки http
 * @param {string} uri исходная ссылка
 * @returns {string} результат
 */
UrlManipulate.prototype.httpLess = function(uri) {
	assert(typeof uri == 'string');

	return uri.replace(/^https?:\/\//i, '');
}

/**
 * Добавляем http к ссылке
 * @param {string} uri исходная ссылка
 * @returns {string} результат
 */
UrlManipulate.prototype.addHttp = function(uri, secure) {
	secure = secure === undefined ? false : secure;

	assert(typeof uri == 'string');

	return (secure ? 'https://' : 'http://') + this.httpLess(uri);
}

/**
 * Проверяем протокол ссылки
 *
 * @param {string} uri ссылка
 * @return {string|boolean} схему или false в случае, если схемы нет
 */
UrlManipulate.prototype.getProto = function(uri) {
	assert(typeof uri == 'string');

	let matches = uri.match(/^(https?)/);

	if (!matches) {
		return false;
	}

	return matches[1];

}

/**
 *
 * Убираем из ссылки www
 * @param {string} uri исходная ссылка
 * @returns {string} результат
 */
UrlManipulate.prototype.wwwLess = function(uri) {
	assert(typeof uri == 'string');

	let proto = this.getProto(uri);
	if (proto) {
		let regexp = new RegExp("^(" + proto + "://)www\.(.+)$", 'i');
		return uri.replace(regexp, "$1$2");
	} else {
		return uri.replace(/^www\.(.+)$/i, '$1');
	}
}

/**
 *
 * Добавляем www к ссылке
 * @param {string} uri исходная ссылка
 * @returns {string} результат
 */
UrlManipulate.prototype.addWww = function(uri) {
	assert(typeof uri == 'string');

	let proto = this.getProto(uri);

	return (proto ? proto + '://' : '') + 'www.' + this.httpLess(this.wwwLess(uri));
}

/**
 * Собираем ссылку из кусочков
 *
 * @param {object} parts части запроса
 * @returns {string} собранный из частей url
 */
UrlManipulate.prototype.buildUrl = function(parts) {
    if (typeof parts != 'object') {
        return parts;
    }

    let uri = '';

    for (let i = 0; i < this._urlNotations.length; i++) {
        let part = this._urlNotations[i];

        if (parts[part.name]) {
            let before = part.hasOwnProperty('before') ? part.before : '';
            let after = part.hasOwnProperty('after') ? part.after : '';

            uri += before + parts[part.name] + after;
        }
    }

    return uri;
}

let man = new UrlManipulate();

module.exports = exports = {};
module.exports = man;
module.exports.UrlManipulate = UrlManipulate;
