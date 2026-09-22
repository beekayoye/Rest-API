import { Router } from 'express';
import restaurantsRouter from './restaurants.js';
import menuItemsRouter from './menuItems.js';
import customersRouter from './customers.js';
import ordersRouter from './orders.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    status: 'online',
    endpoints: {
      restaurants: '/api/v1/restaurants',
      menuItems: '/api/v1/menu-items',
      customers: '/api/v1/customers',
      orders: '/api/v1/orders'
    }
  });
});

router.use('/restaurants', restaurantsRouter);
router.use('/menu-items', menuItemsRouter);
router.use('/customers', customersRouter);
router.use('/orders', ordersRouter);

export default router;
