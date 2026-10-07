# ChikakuShop 🐉

Tienda online de cartas, juegos y snacks con toques de rol (d20, cartas). Los clientes compran en la web y **pagan o recogen en la tienda física**.

- **Frontend:** React 18 + Vite (sin más dependencias)
- **Backend:** Node.js + Express 5 + MongoDB (Mongoose) + JWT
- **Imágenes (opcional):** Cloudinary

## Cómo funciona

| Concepto | Regla |
|---|---|
| Usuarios | Nombre completo, DNI/NIE (se valida la letra), correo y contraseña. Se puede entrar con el correo o con el DNI. |
| Saldos | Cada usuario tiene saldo en **€** (prepago: lo carga el admin) y en **CHIKACOINS**. |
| Precios | Cada producto tiene dos precios que elige el admin: en € y en CHIKACOINS. |
| Catálogo | 9 categorías fijas (Sobres, Fundas, Accesorios TCG, Bebidas, Snacks, Juegos de mesa, Dados, Merchandising, Otros) y etiquetas **Nuevo**, **Destacado** y **Oferta**, que alimentan las secciones de la portada. |
| Pagar con CHIKACOINS | Se descuenta del saldo y el pedido queda **pagado** al momento. Si no hay saldo suficiente, no deja comprar. |
| Pagar en € | Si el saldo en € cubre el total, se descuenta y queda **pagado**. Si no, queda **sin pagar** y se paga en la tienda (el admin lo marca como pagado). |
| Recompensa | 1 € = 100 CHIKACOINS. Se dan al **pagar** un pedido en euros, no al hacerlo. Las compras con CHIKACOINS no generan CHIKACOINS. |
| Nº de pedido | Secuencial y único (1, 2, 3…). |
| Código de pedido | `AÑO-XXXX` con 4 dígitos aleatorios (ej. `2026-0427`), único. Si se usan las 10.000 combinaciones del año, pasa a 5 dígitos (`2026-04271`). |
| Código de barras | Cada producto puede tener su EAN del fabricante o un EAN-13 interno que genera la tienda (empieza por 2). El admin puede leerlo con la cámara, generar los que falten e imprimir etiquetas. |
| Escanear | En el móvil, **Escanear** abre la cámara: cada código leído busca el producto y lo añade al carrito. Usa el lector del navegador (Chrome/Android) o ZXing (iPhone). Necesita HTTPS. |
| Importar / exportar | En **Productos → Importar Excel** se sube un `.xlsx` o `.csv` (plantilla en `client/public/plantilla-productos.xlsx`). Primero se ve una vista previa fila a fila; luego crea o actualiza (por código de barras o por nombre). **Exportar Excel** descarga todos los productos con las mismas columnas para editarlos y volver a importarlos. |
| Cancelar | Devuelve el stock. Si el pedido estaba pagado, devuelve el importe al saldo del cliente y le quita las CHIKACOINS que ganó. |

Todo el dinero se guarda en **céntimos** (enteros) para evitar errores de redondeo.

## Puesta en marcha (local)

Requisitos: Node 20 o superior y una base de datos MongoDB (por ejemplo, el plan gratuito de MongoDB Atlas).

### 1. Backend

```bash
cd server
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
# Edita .env: MONGODB_URI, JWT_SECRET y los datos del admin
npm run seed -- --demo      # crea el admin + 10 productos de ejemplo
npm run dev                 # API en http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
copy .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm run dev                 # web en http://localhost:5173
```

Entra con el correo y la contraseña de admin del `.env` y verás la pestaña **Panel del Master**.

### Pruebas

```bash
cd server
npm test
```

Las pruebas levantan una MongoDB en memoria y recorren el flujo completo: registro, compras, pago en tienda, recompensas, cancelaciones y el paso a 5 dígitos del código.

## Despliegue en Render

1. **Backend** → *Web Service* con raíz `server`, build `npm install`, start `npm start`. Añade las variables del `.env`. En `CLIENT_URL` pon la URL del frontend.
2. **Frontend** → *Static Site* con raíz `client`, build `npm install && npm run build` y carpeta de publicación `dist`. Añade `VITE_API_URL=https://tu-backend.onrender.com/api`.
3. Ejecuta una vez `npm run seed` (desde la *Shell* de Render o en local apuntando a la base de datos de producción).

Las rutas usan `#/` (hash), así que el sitio estático funciona sin configurar redirecciones.

## API

| Método | Ruta | Quién |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | público |
| GET | `/api/auth/me` | usuario |
| GET | `/api/products` (`q`, `category`, `tag`, `sort`, `page`) · `/api/products/categories` · `/api/products/barcode/:code` | público |
| POST | `/api/admin/products/barcode/generate` · `/api/admin/products/barcode/fill` | admin |
| POST | `/api/admin/products/import` `{ rows, dryRun }` (vista previa con `dryRun: true`) | admin |
| POST | `/api/orders` `{ currency: 'EUR'\|'COINS', items: [{ productId, quantity }] }` | usuario |
| GET | `/api/orders/mine` · `/api/orders/mine/movements` | usuario |
| GET/POST/PATCH/DELETE | `/api/admin/products` | admin |
| GET/PATCH | `/api/admin/orders` (`status`, `items`, `adminNote`) | admin |
| GET/POST/PATCH | `/api/admin/users` (alta con contraseña inicial; al editar, todo menos la contraseña) | admin |
| POST | `/api/admin/users/:id/topup` `{ currency, amount, note }` | admin |
| GET | `/api/admin/overview?period=day\|month\|year` (tarjetas + gráfico del panel) · `/api/admin/stats` · `/api/admin/summary` | admin |
| POST | `/api/admin/upload` (imagen → Cloudinary) | admin |

## Estructura

```
server/
  src/models        User, Product, Order, Counter, Movement
  src/services      orderService (compras, pagos, cancelaciones), orderCode (códigos únicos)
  src/routes        auth, products, orders, admin
  test/             pruebas de extremo a extremo
client/
  src/pages         Login, Shop (portada, catálogo, categorías, favoritos), Cart, Orders, Profile
  src/pages/admin   Dashboard (resumen + pedidos), AdminOrders, AdminProducts, AdminUsers
  src/components    ProductCard, Navbar, Icon (iconos y logo), ui
```
