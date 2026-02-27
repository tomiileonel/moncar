import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: ''
    });
    await connection.query('CREATE DATABASE IF NOT EXISTS moncar;');
    console.log('Database created');
    connection.end();
}
main();
