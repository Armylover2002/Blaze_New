const fs = require('fs');
const file = 'c:/Users/admin/Desktop/Blaze/Frontend/src/modules/quickCommerce/user/pages/CheckoutPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace green theme colors with red theme colors
content = content.replace(/#0c831f/g, '#FF0000');
content = content.replace(/bg-green-50/g, 'bg-[#FFF2EB]');
content = content.replace(/bg-green-100/g, 'bg-[#FFE8DB]');
content = content.replace(/#0b721b/g, '#CC0000');
content = content.replace(/border-green-600/g, 'border-[#FF0000]');
content = content.replace(/bg-emerald-/g, 'bg-red-');
content = content.replace(/text-emerald-/g, 'text-red-');
content = content.replace(/text-teal-700/g, 'text-red-700');

fs.writeFileSync(file, content);
console.log('Done replacing colors in CheckoutPage.jsx');
