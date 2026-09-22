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

const CUISINE_IMAGES = {
  Italian: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=800&auto=format&fit=crop&q=80',
  ],
  Japanese: [
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=800&auto=format&fit=crop&q=80',
  ],
  Mexican: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?w=800&auto=format&fit=crop&q=80',
  ],
  Indian: [
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
  ],
  Chinese: [
    'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=80',
  ],
  Thai: [
    'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  ],
  American: [
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=800&auto=format&fit=crop&q=80',
  ],
  Mediterranean: [
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80',
  ],
  French: [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=800&auto=format&fit=crop&q=80',
  ],
  Korean: [
    'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1583032015879-6238b6938a19?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800&auto=format&fit=crop&q=80',
  ],
  Vietnamese: [
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503764654157-72d979d9af2f?w=800&auto=format&fit=crop&q=80',
  ],
  Nigerian: [
    'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&auto=format&fit=crop&q=80',
  ],
  Ethiopian: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  ],
  Greek: [
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&auto=format&fit=crop&q=80',
  ],
  Spanish: [
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=800&auto=format&fit=crop&q=80',
  ],
  Caribbean: [
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
  ]
};

const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80';

function getCuisineFoodImage(cuisine) {
  const images = CUISINE_IMAGES[cuisine] || [DEFAULT_FOOD_IMAGE];
  return faker.helpers.arrayElement(images);
}

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
  console.log('Generating seed data with authentic food images...');
  
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
    const imageUrl = getCuisineFoodImage(cuisine);
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

  console.log(`✔ Generated api/db.json with high-resolution food images:`);
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
