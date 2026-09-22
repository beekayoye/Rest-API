/**
 * ============================================================================
 * Food Delivery API — Idempotent Database Seed Script
 * ============================================================================
 * 
 * 1. Connects via pg pool from db/pool.js
 * 2. Runs inside ONE transaction starting with TRUNCATE CASCADE for idempotency
 * 3. 200 Restaurants across 16 curated cuisines
 * 4. 5-12 Menu Items per restaurant with faker.food dishes and descriptions
 * 5. 300 Customers with deduped unique emails
 * 6. 400 Orders (70% delivered, 1-4 items each, backdated created_at in last year)
 * 7. Prefixed IDs (rst_, mnu_, cus_, ord_, oit_) from utils/ids.js
 * 8. Logs a one-line count summary per table at the end
 * ============================================================================
 */

import { faker } from '@faker-js/faker';
import pool from './db/pool.js';
import { generateId, PREFIXES } from './utils/ids.js';

// Deterministic seed for reproducible data generation
faker.seed(42);

const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'Indian', 'Chinese', 'Thai',
  'American', 'Mediterranean', 'French', 'Korean', 'Vietnamese',
  'Nigerian', 'Ethiopian', 'Greek', 'Spanish', 'Caribbean'
];

const CATEGORIES = [
  'Appetizers', 'Main Course', 'Sides', 'Salads', 'Desserts', 'Drinks', 'Specials'
];

const OTHER_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'cancelled'];

function getRandomStatus() {
  // 70% chance of 'delivered', 30% distributed among other statuses
  const rand = faker.number.float({ min: 0, max: 1 });
  if (rand < 0.7) {
    return 'delivered';
  }
  return faker.helpers.arrayElement(OTHER_STATUSES);
}

export async function seed() {
  const client = await pool.connect();
  console.log('🌱 Starting database seeding...');

  try {
    await client.query('BEGIN');

    // 1. Idempotent Truncate
    console.log('Clearing existing data with TRUNCATE CASCADE...');
    await client.query('TRUNCATE TABLE order_items, orders, menu_items, restaurants, customers CASCADE;');

    // 2. Seed Restaurants (200)
    console.log('Creating 200 restaurants...');
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

      await client.query(`
        INSERT INTO restaurants (id, name, cuisine, description, address, city, rating, price_level, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [id, name, cuisine, description, address, city, rating, priceLevel, imageUrl]);
    }

    // 3. Seed Menu Items (5-12 per restaurant)
    console.log('Creating menu items (5-12 per restaurant)...');
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

        await client.query(`
          INSERT INTO menu_items (id, restaurant_id, name, description, category, price_cents, is_available)
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [id, r.id, name, description, category, priceCents, isAvailable]);
      }
    }

    // Group available menu items by restaurant for fast lookup during order generation
    const availableItemsByRestaurant = new Map();
    for (const item of menuItems) {
      if (item.isAvailable) {
        if (!availableItemsByRestaurant.has(item.restaurantId)) {
          availableItemsByRestaurant.set(item.restaurantId, []);
        }
        availableItemsByRestaurant.get(item.restaurantId).push(item);
      }
    }

    // 4. Seed Customers (300 with unique emails)
    console.log('Creating 300 customers...');
    const customers = [];
    const usedEmails = new Set();

    for (let i = 0; i < 300; i++) {
      const id = generateId(PREFIXES.customer);
      const name = faker.person.fullName();
      let email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] }).toLowerCase();
      
      // Deduplicate email before insert
      while (usedEmails.has(email)) {
        email = `${faker.string.alphanumeric(4)}_${email}`;
      }
      usedEmails.add(email);

      const phone = faker.phone.number();

      customers.push({ id, name, email, phone });

      await client.query(`
        INSERT INTO customers (id, name, email, phone)
        VALUES ($1, $2, $3, $4);
      `, [id, name, email, phone]);
    }

    // 5. Seed Orders (400 orders)
    console.log('Creating 400 orders with items...');
    for (let i = 0; i < 400; i++) {
      const id = generateId(PREFIXES.order);
      const restaurant = faker.helpers.arrayElement(restaurants);
      const customer = faker.helpers.arrayElement(customers);
      const status = getRandomStatus();
      const deliveryAddress = `${faker.location.streetAddress()}, ${restaurant.city}`;
      const createdAt = faker.date.past({ years: 1 });

      const restaurantAvailableItems = availableItemsByRestaurant.get(restaurant.id) || [];
      if (restaurantAvailableItems.length === 0) continue;

      // Pick 1 to 4 items strictly from this restaurant
      const itemsCount = faker.number.int({ min: 1, max: Math.min(4, restaurantAvailableItems.length) });
      const itemsToOrder = faker.helpers.arrayElements(restaurantAvailableItems, itemsCount);
      
      let totalCents = 0;
      const orderItemsToInsert = [];

      for (const item of itemsToOrder) {
        const orderItemId = generateId(PREFIXES.orderItem);
        const quantity = faker.number.int({ min: 1, max: 3 });
        const unitPriceCents = item.priceCents;
        totalCents += quantity * unitPriceCents;

        orderItemsToInsert.push({
          id: orderItemId,
          orderId: id,
          menuItemId: item.id,
          quantity,
          unitPriceCents,
        });
      }

      // Insert Order with backdated createdAt
      await client.query(`
        INSERT INTO orders (id, restaurant_id, customer_id, status, delivery_address, total_cents, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7);
      `, [id, restaurant.id, customer.id, status, deliveryAddress, totalCents, createdAt]);

      // Insert Order Items
      for (const oItem of orderItemsToInsert) {
        await client.query(`
          INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price_cents)
          VALUES ($1, $2, $3, $4, $5);
        `, [oItem.id, oItem.orderId, oItem.menuItemId, oItem.quantity, oItem.unitPriceCents]);
      }
    }

    await client.query('COMMIT');

    // 6. Query and log one-line table count summary
    const [rCount, mCount, cCount, oCount, oiCount] = await Promise.all([
      client.query('SELECT COUNT(*) FROM restaurants'),
      client.query('SELECT COUNT(*) FROM menu_items'),
      client.query('SELECT COUNT(*) FROM customers'),
      client.query('SELECT COUNT(*) FROM orders'),
      client.query('SELECT COUNT(*) FROM order_items'),
    ]);

    const summaryLine = `📊 Table Counts -> restaurants: ${rCount.rows[0].count} | menu_items: ${mCount.rows[0].count} | customers: ${cCount.rows[0].count} | orders: ${oCount.rows[0].count} | order_items: ${oiCount.rows[0].count}`;
    console.log('\n' + summaryLine);
    console.log('✨ Database seeding finished successfully!\n');
    return summaryLine;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run if invoked directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed()
    .then(() => pool.end())
    .catch(() => {
      pool.end();
      process.exit(1);
    });
}

export default seed;
