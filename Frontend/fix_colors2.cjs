const fs = require('fs');
const file = 'c:/Users/admin/Desktop/Blaze/Frontend/src/modules/quickCommerce/user/pages/CheckoutPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace green theme colors with red theme colors
content = content.replace(/text-green-100/g, 'text-red-100');
content = content.replace(/text-green-800/g, 'text-red-800');
content = content.replace(/bg-green-900/g, 'bg-red-900');
content = content.replace(/text-green-300/g, 'text-red-300');
content = content.replace(/border-green-100/g, 'border-red-100');
content = content.replace(/text-green-700/g, 'text-red-700');

// Fix text sizes (bump up the tiny hardcoded ones)
content = content.replace(/text-\[10px\]/g, 'text-[12px]');
content = content.replace(/text-\[11px\]/g, 'text-[13px]');
content = content.replace(/text-\[9px\]/g, 'text-[11px]');

fs.writeFileSync(file, content);
console.log('Done fixing remaining colors and text sizes in CheckoutPage.jsx');
