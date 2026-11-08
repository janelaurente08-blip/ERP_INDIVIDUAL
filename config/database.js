import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  "labor_productivity_management",
  "root",
  "",
  {
    host: "localhost",
    dialect: "mysql",
    logging: false,
  }
);

export default sequelize;
