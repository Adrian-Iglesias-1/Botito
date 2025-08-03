const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const APTRA_URL = process.env.APTRA_URL || 'https://vision.dcs.latam.ncr.com/cxp-core';
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('excel'), async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const { username, password } = req.body;
    if (!req.file || !username || !password) {
      return res.status(400).send('Faltan archivo Excel, usuario o contraseña');
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).send('Archivo demasiado grande');
    }
    if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
      return res.status(400).send('Formato de archivo no válido');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1);
    const data = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      data.push({
        ID: row.getCell(1).value,
        Status: row.getCell(2).value,
        Fecha: row.getCell(3).value,
        Hora: row.getCell(4).value
      });
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    try {
      await page.goto(`${APTRA_URL}/login`, { waitUntil: 'networkidle2' });
      console.log('Intentando iniciar sesión');
      await page.type('#username', username);
      await page.type('#password', password);
      await page.click('#login-button');
      await page.waitForSelector('#dashboard', { timeout: 10000 }); // Ajusta selector de dashboard
      console.log('Sesión iniciada');

      for (const row of data) {
        const { ID, Status, Fecha, Hora } = row;
        if (!ID || !Status || !Fecha || !Hora) {
          console.log(`Fila incompleta para ID: ${ID || 'desconocido'}`);
          continue;
        }

        console.log(`Procesando ID: ${ID}`);
        await page.goto(`${APTRA_URL}/search`, { waitUntil: 'networkidle2' });
        await page.type('#search-id', ID.toString());
        await page.click('#search-button');
        await page.waitForSelector('#results', { timeout: 10000 });

        await page.type('#status-field', Status.toString());
        await page.type('#date-field', Fecha.toString());
        await page.type('#time-field', Hora.toString());
        await page.click('#create-event-button');
        await page.waitForSelector('#confirmation', { timeout: 10000 });
        console.log(`Evento creado para ID: ${ID}`);
      }

      await browser.close();
      fs.unlinkSync(req.file.path);
      res.send('Procesamiento completado exitosamente');
    } catch (error) {
      console.error(`Error en el flujo: ${error.message}`);
      await browser.close();
      fs.unlinkSync(req.file.path);
      res.status(500).send(`Error en el procesamiento: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error general: ${error.message}`);
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));