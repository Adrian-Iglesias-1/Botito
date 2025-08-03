const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const APTRA_URL = process.env.APTRA_URL || 'https://aptra-url.com';
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('excel'), async (req, res) => {
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
      await page.type('#username', username);
      await page.type('#password', password);
      await page.click('#login-button');
      await page.waitForNavigation();

      for (const row of data) {
        const { ID, Status, Fecha, Hora } = row;
        if (!ID || !Status || !Fecha || !Hora) {
          console.log(`Fila incompleta para ID: ${ID}`);
          continue;
        }

        await page.goto(`${APTRA_URL}/search`, { waitUntil: 'networkidle2' });
        await page.type('#search-id', ID.toString());
        await page.click('#search-button');
        await page.waitForSelector('#results', { timeout: 5000 });

        await page.type('#status-field', Status);
        await page.type('#date-field', Fecha);
        await page.type('#time-field', Hora);
        await page.click('#create-event-button');
        await page.waitForSelector('#confirmation', { timeout: 5000 });
        console.log(`Evento creado para ID: ${ID}`);
      }

      await browser.close();
      fs.unlinkSync(req.file.path);
      res.send('Procesamiento completado exitosamente');
    } catch (error) {
      await browser.close();
      fs.unlinkSync(req.file.path);
      res.status(500).send(`Error en el procesamiento: ${error.message}`);
    }
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));