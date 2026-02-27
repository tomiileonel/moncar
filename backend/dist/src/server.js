import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import vehicleRoutes from './routes/vehicle.routes';
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.listen(port, () => {
    console.log(`[Server]: Moncar APIs listening at http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map