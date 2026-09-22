import { newDb } from 'pg-mem';
import fs from 'node:fs';
import path from 'node:path';
import { faker } from '@faker-js/faker';
import { generateId, PREFIXES } from '../utils/ids.js';

async function testSeedIdempotency() {
  console.log('--- Testing Seed Logic with In-Memory Postgres ---');
  const db = newDb();
  
  // Register timestamptz / now
  const schemaSql = fs.readFileSync(path.resolve('db/schema.sql'), 'utf8');
  db.public.none(schemaSql);
  
  const { Pool } = db.adapters.createPg();
  const client = new Pool();

  async function runSeedOnClient() {
    faker.seed(42);

    const CUISINES = [
      'Italian', 'Mexican', 'Japanese', 'Indian', 'Chinese', 'Thai',
      'American', 'Mediterranean', 'French', 'Korean', 'Vietnamese',
      'Nigerian', 'Ethiopian', 'Greek', 'Spanish', 'Caribbean'
    ];
    const CATEGORIES = ['Appetizers', 'Main Course', 'Sides', 'Salads', 'Desserts', 'Drinks', 'Specials'];
    const OTHER_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'cancelled'];

    function getRandomStatus() {
      const rand = faker.number.float({ min: 0, max: 1 });
      if (rand < 0.7) return 'delivered';
      return faker.helpers.arrayElement(OTHER_STATUSES);
    }

    const pgClient = await client.connect();
    try {
      await pgClient.query('BEGIN');
      await pgClient.query('TRUNCATE TABLE order_items CASCADE;');
      await pgClient.query('TRUNCATE TABLE orders CASCADE;');
      await pgClient.query('TRUNCATE TABLE menu_items CASCADE;');
      await pgClient.query('TRUNCATE TABLE restaurants CASCADE;');
      await pgClient.query('TRUNCATE TABLE customers CASCADE;');

      const restaurants = [];
      for (let i = 0; i < 200; i++) {
        const id = generateId(PREFIXES.restaurant);
        const name = `${faker.company.name()} ${faker.helpers.arrayElement(['Bistro', 'Kitchen', 'Eats', 'Diner', 'Grill', 'House', 'Cafe', 'Tavern', 'Spot', 'Oven'])}`;
        const cuisine = faker.helpers.arrayElement(CUISINES);
        const description = faker.company.catchPhrase();
        const address = faker.location.streetAddress();
        const city = faker.location.city();
        const rating = Number(faker.number.float({ min: 2.5, max: 5.0, fractionDigits: 1 }));
        const priceLevel = faker.number.int({ min: 1, max: 4 });
        const imageUrl = faker.image.urlLoremFlickr({ category: 'food' });

        restaurants.push({ id, name, cuisine, description, address, city, rating, priceLevel, imageUrl });
        await pgClient.query(`
          INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        `, [id, name, cuisine, description, address, city, rating, priceLevel, imageUrl]);
      }

      const menuItems = [];
      for (const r of restaurants) {
        const itemCount = faker.number.int({ min: 5, max: 12 });
        for (let j = 0; j < itemCount; j++) {
          const id = generateId(PREFIXES.menuItem);
          const name = faker.food?.dish ? faker.food.dish() : `${faker.word.adjective()} ${faker.food?.ingredient ? faker.food.ingredient() : 'Special'}`;
          const description = faker.food?.description ? faker.food.description() : faker.lorem.sentence();
          const category = faker.helpers.arrayElement(CATEGORIES);
          const priceCents = faker.number.int({ min: 300, max: 4500 });
          const isAvailable = faker.datatype.boolean({ probability: 0.9 });

          menuItems.push({ id, restaurantId: r.id, name, description, category, priceCents, isAvailable });
          await pgClient.query(`
            INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [id, r.id, name, description, category, priceCents, isAvailable]);
        }
      }

      const availableItemsByRestaurant = new Map();
      for (const item of menuItems) {
        if (item.isAvailable) {
          if (!availableItemsByRestaurant.has(item.restaurantId)) {
            availableItemsByRestaurant.set(item.restaurantId, []);
          }
          availableItemsByRestaurant.get(item.restaurantId).push(item);
        }
      }

      const customers = [];
      const usedEmails = new Set();
      for (let i = 0; i < 300; i++) {
        const id = generateId(PREFIXES.customer);
        const name = faker.person.fullName();
        let email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] }).toLowerCase();
        while (usedEmails.has(email)) {
          email = `${faker.string.alphanumeric(4)}_${email}`;
        }
        usedEmails.add(email);
        const phone = faker.phone.number();

        customers.push({ id, name, email, phone });
        await pgClient.query(`
          INSERT INTO customers (id, name, email, phone)
          VALUES ($1, $2, $3, $4);
        `, [id, name, email, phone]);
      }

      for (let i = 0; i < 400; i++) {
        const id = generateId(PREFIXES.order);
        const restaurant = faker.helpers.arrayElement(restaurants);
        const customer = faker.helpers.arrayElement(customers);
        const status = getRandomStatus();
        const deliveryAddress = `${faker.location.streetAddress()}, ${restaurant.city}`;
        const createdAt = faker.date.past({ years: 1 });

        const restaurantAvailableItems = availableItemsByRestaurant.get(restaurant.id) || [];
        if (restaurantAvailableItems.length === 0) continue;

        const itemsCount = faker.number.int({ min: 1, max: Math.min(4, restaurantAvailableItems.length) });
        const itemsToOrder = faker.helpers.arrayElements(restaurantAvailableItems, itemsCount);

        let totalCents = 0;
        const orderItemsToInsert = [];

        for (const item of itemsToOrder) {
          const orderItemId = generateId(PREFIXES.orderItem);
          const quantity = faker.number.int({ min: 1, max: 3 });
          const unitPriceCents = item.priceCents;
          totalCents += quantity * unitPriceCents;
          orderItemsToInsert.push({ id: orderItemId, orderId: id, menuItemId: item.id, quantity, unitPriceCents });
        }

        await pgClient.query(`
          INSERT INTO orders (id, restaurant_id, customer_id, status, delivery_address, total_cents, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7);
        `, [id, restaurant.id, customer.id, status, deliveryAddress, totalCents, createdAt]);

        for (const oItem of orderItemsToInsert) {
          await pgClient.query(`
            INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents)
            VALUES ($1, $2, $3, $4, $5);
          `, [oItem.id, oItem.orderId, oItem.menuItemId, oItem.quantity, oItem.unitPriceCents]);
        }
      }

      await pgClient.query('COMMIT');

      const [rCount, mCount, cCount, oCount, oiCount] = await Promise.all([
        pgClient.query('SELECT COUNT(*) FROM restaurants'),
        pgClient.query('SELECT COUNT(*) FROM menu_items'),
        pgClient.query('SELECT COUNT(*) FROM customers'),
        pgClient.query('SELECT COUNT(*) FROM orders'),
        pgClient.query('SELECT COUNT(*) FROM order_items'),
      ]);

      const summary = `restaurants: ${rCount.rows[0].count} | menu_items: ${mCount.rows[0].count} | customers: ${cCount.rows[0].count} | orders: ${oCount.rows[0].count} | order_items: ${oiCount.rows[0].count}`;
      return summary;
    } finally {
      pgClient.release();
    }
  }

  const run1 = await runSeedOnClient();
  console.log('Run 1 Summary:', run1);
  const run2 = await runSeedOnClient();
  console.log('Run 2 Summary:', run2);

  if (run1 === run2) {
    console.log('✔ Idempotency check PASSED: Row counts are identical on repeated runs.');
  } else {
    throw new Error(`Idempotency check failed: "${run1}" !== "${run2}"`);
  }
}

testSeedIdempotency().catch((err) => {
  console.error(err);
  process.exit(1);
});
