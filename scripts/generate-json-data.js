import fs from 'node:fs';
import path from 'node:path';
import { faker } from '@faker-js/faker';
import { generateId, PREFIXES } from '../utils/ids.js';

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
  const rand = faker.number.float({ min: 0, max: 1 });
  if (rand < 0.7) return 'delivered';
  return faker.helpers.arrayElement(OTHER_STATUSES);
}

export function generateSeedData() {
  console.log('Generating seed data for JSON storage...');
  
  // 1. Restaurants
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
    const createdAt = faker.date.past({ years: 1 }).toISOString();

    restaurants.push({
      id,
      name,
      cuisine,
      description,
      address,
      city,
      rating,
      price_level: priceLevel,
      image_url: imageUrl,
      created_at: createdAt,
    });
  }

  // 2. Menu Items
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
      const createdAt = faker.date.past({ years: 1 }).toISOString();

      menuItems.push({
        id,
        restaurant_id: r.id,
        name,
        description,
        category,
        price_cents: priceCents,
        is_available: isAvailable,
        created_at: createdAt,
      });
    }
  }

  // Group available menu items by restaurant
  const availableItemsByRestaurant = new Map();
  for (const item of menuItems) {
    if (item.is_available) {
      if (!availableItemsByRestaurant.has(item.restaurant_id)) {
        availableItemsByRestaurant.set(item.restaurant_id, []);
      }
      availableItemsByRestaurant.get(item.restaurant_id).push(item);
    }
  }

  // 3. Customers
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
    const createdAt = faker.date.past({ years: 1 }).toISOString();

    customers.push({ id, name, email, phone, created_at: createdAt });
  }

  // 4. Orders & Order Items
  const orders = [];
  const orderItems = [];

  for (let i = 0; i < 400; i++) {
    const id = generateId(PREFIXES.order);
    const restaurant = faker.helpers.arrayElement(restaurants);
    const customer = faker.helpers.arrayElement(customers);
    const status = getRandomStatus();
    const deliveryAddress = `${faker.location.streetAddress()}, ${restaurant.city}`;
    const createdAt = faker.date.past({ years: 1 }).toISOString();

    const restaurantAvailableItems = availableItemsByRestaurant.get(restaurant.id) || [];
    if (restaurantAvailableItems.length === 0) continue;

    const itemsCount = faker.number.int({ min: 1, max: Math.min(4, restaurantAvailableItems.length) });
    const itemsToOrder = faker.helpers.arrayElements(restaurantAvailableItems, itemsCount);

    let totalCents = 0;
    for (const item of itemsToOrder) {
      const orderItemId = generateId(PREFIXES.orderItem);
      const quantity = faker.number.int({ min: 1, max: 3 });
      const unitPriceCents = item.price_cents;
      totalCents += quantity * unitPriceCents;

      orderItems.push({
        id: orderItemId,
        order_id: id,
        menu_item_id: item.id,
        quantity,
        unit_price_cents: unitPriceCents,
      });
    }

    orders.push({
      id,
      restaurant_id: restaurant.id,
      customer_id: customer.id,
      status,
      delivery_address: deliveryAddress,
      total_cents: totalCents,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  const dataset = {
    restaurants,
    menu_items: menuItems,
    customers,
    orders,
    order_items: orderItems,
  };

  const dataDir = path.resolve('api');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filePath = path.join(dataDir, 'db.json');
  fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2), 'utf8');

  console.log(`✔ Generated api/db.json with:`);
  console.log(`  - ${restaurants.length} restaurants`);
  console.log(`  - ${menuItems.length} menu items`);
  console.log(`  - ${customers.length} customers`);
  console.log(`  - ${orders.length} orders`);
  console.log(`  - ${orderItems.length} order items`);

  return dataset;
}

if (process.argv[1] && process.argv[1].endsWith('generate-json-data.js')) {
  generateSeedData();
}
