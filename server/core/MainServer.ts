import express, { Express } from "express";
import http from "http";
import cookieParser from "cookie-parser";
import session from "express-session";
import cors from "cors";

import Controller from "./Controller";
import RedisWorks from "./Redis";
import { ISocketUsers } from "../types/socket.types";
import PassportWorks from "./Passport";
import Database from "./Database";
import SocketWorks from "./Socket";

const COOKIE_NAME = process.env.COOKIE_NAME || "sid";
const SECRET_KEY = process.env.SECRET_KEY || "SECRET_KEY";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

interface IContructor {
    app: Express;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
};

export default class MainServer {
    private _app: Express;
    private _users: ISocketUsers;
    private _redisWork: RedisWorks;
    private _database: Database;
    private _passport: PassportWorks;

    constructor({ app, server }: IContructor) {
        this._app = app;
        this._users = {};

        // Инициализируем работу Redis
        this._redisWork = new RedisWorks();
        // Инициализируем мидлвары Express
        this._useExpressMiddlewares();
        // Инициализируем работу базы данных (модели, отношения)
        this._database = new Database();
        // Инициализируем работу Passport (мидлвары)
        this._passport = new PassportWorks({ app: this._app, database: this._database });
        // Инициализируем работу API
        new Controller({ 
            redisWork: this._redisWork, 
            app: this._app, 
            users: this._users,
            database: this._database,
            passport: this._passport.passport
        });
        // Инициализируем работу socket.io
        new SocketWorks({ server, users: this._users, database: this._database });
    }

    private _useExpressMiddlewares() {
        this._app.use(cors({ credentials: true, origin: CLIENT_URL }));        // Для CORS-заголовков
        this._app.use(express.json());                                         // Для парсинга json строки
        this._app.use(cookieParser());                                         // Парсим cookie (позволяет получить доступ к куки через req.cookie)
        this._app.use(session({                                                // Инициализируем express-сессию для пользователей с хранилищем в Redis
            store: this._redisWork.redisStore,
            name: COOKIE_NAME,
            secret: SECRET_KEY,
            cookie: {
                secure: false,
                httpOnly: true,
                domain: "localhost"
            },
            resave: true,                       // Продлевает maxAge при каждом новом запросе
            rolling: true,                      // Продлевает maxAge при каждом новом запросе
            saveUninitialized: false            // Не помещает в store пустые сессии
        }));
    }

    // Закрываем соединение с бд
    public closeDatabase() {
        this._database.close();
    }
};