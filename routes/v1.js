import { Router } from 'express';
import restaurantsRouter from './restaurants.js';
import menuItemsRouter from './menuItems.js';
import customersRouter from './customers.js';
import ordersRouter from './orders.js';

const router = Router();

router.use('/restaurants', restaurantsRouter);
router.use('/menu-items', menuItemsRouter);
router.use('/customers', customersRouter);
router.use('/orders', ordersRouter);

export default router;
