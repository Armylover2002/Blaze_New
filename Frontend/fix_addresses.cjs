const fs = require('fs');
const file = 'c:/Users/admin/Desktop/Blaze/Frontend/src/modules/quickCommerce/user/pages/AddressesPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace green theme colors with red theme colors
content = content.replace(/#0c831f/g, '#FF0000');
content = content.replace(/bg-green-100/g, 'bg-[#FFE8DB]');
content = content.replace(/bg-green-50/g, 'bg-[#FFF2EB]');
content = content.replace(/bg-green-600/g, 'bg-[#FF0000]');
content = content.replace(/bg-green-500/g, 'bg-[#E60000]');
content = content.replace(/bg-green-400/g, 'bg-[#FF3333]');
content = content.replace(/text-green-600/g, 'text-[#FF0000]');
content = content.replace(/text-green-700/g, 'text-red-700');
content = content.replace(/text-green-800/g, 'text-red-800');
content = content.replace(/text-green-500/g, 'text-[#FF0000]');
content = content.replace(/border-green-100/g, 'border-[#FFE8DB]');
content = content.replace(/border-green-200/g, 'border-[#FFCCCC]');
content = content.replace(/border-green-600/g, 'border-[#FF0000]');
content = content.replace(/shadow-green-900\/40/g, 'shadow-red-900/40');
content = content.replace(/dark:bg-green-900\/30/g, 'dark:bg-red-900/30');
content = content.replace(/dark:hover:bg-green-900\/10/g, 'dark:hover:bg-red-900/10');
content = content.replace(/hover:bg-green-50/g, 'hover:bg-[#FFF2EB]');

fs.writeFileSync(file, content);
console.log('Fixed green colors to red in AddressesPage.jsx');
