import Knex, { Knex as KnexTypes } from 'knex';
import { Model } from 'objection';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

const config: KnexTypes.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'yourfirstmove',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    ...(isProduction && {
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  },
  pool: {
    min: 2,
    max: isProduction ? 20 : 10,
  },
};

export const knex = Knex(config);

// Bind Objection.js models to Knex instance
Model.knex(knex);

export default knex;
