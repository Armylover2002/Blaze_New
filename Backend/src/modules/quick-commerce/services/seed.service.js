import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';

const categoriesSeed = [
  {
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44889.png',
    accentColor: '#66bb6a',
    sortOrder: 1,
  },
  {
    name: 'Dairy, Bread & Eggs',
    slug: 'dairy-bread-eggs',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44910.png',
    accentColor: '#f7ca4d',
    sortOrder: 2,
  },
  {
    name: 'Cold Drinks & Juices',
    slug: 'cold-drinks-juices',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44907.png',
    accentColor: '#80deea',
    sortOrder: 3,
  },
  {
    name: 'Snacks & Munchies',
    slug: 'snacks-munchies',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2023-01/44908.png',
    accentColor: '#ffcc80',
    sortOrder: 4,
  },
  {
    name: 'Bakery & Biscuits',
    slug: 'bakery-biscuits',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44901.png',
    accentColor: '#bcaaa4',
    sortOrder: 5,
  },
  {
    name: 'Instant & Frozen Food',
    slug: 'instant-frozen-food',
    type: 'header',
    image: 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout_item/2022-09/44917.png',
    accentColor: '#a5d6a7',
    sortOrder: 6,
  },
];

let isSeedingVerified = false;
let seedingPromise = null;

const removeMockProducts = async () => {
  // Seed/mock products had no seller and rendered as shop name "Admin" in admin UI.
  const result = await QuickProduct.deleteMany({
    $or: [{ sellerId: null }, { sellerId: { $exists: false } }],
  });

  if (result.deletedCount > 0) {
    console.log(`Removed ${result.deletedCount} mock/seller-less quick-commerce products`);
  }
};

export const ensureQuickCommerceSeedData = async () => {
  if (isSeedingVerified) return;
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const existingCategories = await QuickCategory.countDocuments();

      if (existingCategories === 0) {
        await QuickCategory.insertMany(categoriesSeed);
      }

      // Never re-seed catalog products; purge legacy mock rows that show as shop "Admin".
      await removeMockProducts();

      isSeedingVerified = true;
    } catch (err) {
      console.error('Quick Commerce seeding failed:', err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
};
