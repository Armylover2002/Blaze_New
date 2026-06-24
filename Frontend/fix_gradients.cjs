const fs = require('fs');
const file = 'c:/Users/admin/Desktop/Blaze/Frontend/src/modules/quickCommerce/user/pages/CheckoutPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix Start Shopping button gradient
content = content.replace(/from-\[#FF0000\] to-\[#10b981\]/g, 'from-[#FF0000] to-[#CC0000]');
content = content.replace(/shadow-green-600\/20/g, 'shadow-red-600/20');

// Fix empty box border
content = content.replace(/border-emerald-100/g, 'border-red-100');

// Fix top header gradient and green blobs
content = content.replace(/from-\[#0a5f17\] via-\[#CC0000\] to-\[#084a12\]/g, 'from-[#FF0000] via-[#E60000] to-[#CC0000]');
content = content.replace(/bg-green-400\/10/g, 'bg-[#FFF2EB]/10');
content = content.replace(/bg-green-400/g, 'bg-[#FFF2EB]');

fs.writeFileSync(file, content);
console.log('Fixed multiline color gradients in CheckoutPage.jsx');
