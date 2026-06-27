const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure output directories exist
const svgDir = path.join(__dirname, 'svg');
const pngDir = path.join(__dirname, 'png');

if (!fs.existsSync(svgDir)) fs.mkdirSync(svgDir);
if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);

// Helpers
const shadowFilter = `
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="15" flood-opacity="0.25"/>
    </filter>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.15"/>
    </filter>
  </defs>
`;

// Base container
const createSvg = (content) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${shadowFilter}
  ${content}
</svg>
`;

const icons = {};

// 1. Bike
icons['bike'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Wheels -->
    <rect x="236" y="80" width="40" height="90" rx="15" fill="#1e293b" />
    <rect x="236" y="342" width="40" height="90" rx="15" fill="#1e293b" />
    <!-- Body -->
    <path d="M226 140 L286 140 L296 220 L276 360 L236 360 L216 220 Z" fill="#3b82f6" />
    <path d="M236 140 L276 140 L281 220 L266 350 L246 350 L231 220 Z" fill="#2563eb" />
    <!-- Handlebars -->
    <rect x="176" y="160" width="160" height="12" rx="6" fill="#475569" />
    <rect x="176" y="150" width="16" height="32" rx="4" fill="#0f172a" />
    <rect x="320" y="150" width="16" height="32" rx="4" fill="#0f172a" />
    <!-- Seat -->
    <path d="M236 240 L276 240 L286 320 L276 340 L236 340 L226 320 Z" fill="#0f172a" />
  </g>
`);

// 2. Scooter
icons['scooter'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Wheels -->
    <rect x="236" y="90" width="40" height="80" rx="15" fill="#1e293b" />
    <rect x="236" y="342" width="40" height="80" rx="15" fill="#1e293b" />
    <!-- Body Base -->
    <path d="M216 130 L296 130 L316 200 L296 360 L216 360 L196 200 Z" fill="#ef4444" />
    <!-- Floorboard -->
    <rect x="226" y="210" width="60" height="60" rx="5" fill="#334155" />
    <!-- Handlebars -->
    <rect x="186" y="150" width="140" height="20" rx="10" fill="#dc2626" />
    <rect x="186" y="145" width="20" height="30" rx="5" fill="#0f172a" />
    <rect x="306" y="145" width="20" height="30" rx="5" fill="#0f172a" />
    <!-- Headlight -->
    <rect x="240" y="130" width="32" height="16" rx="8" fill="#fef08a" />
    <!-- Seat -->
    <path d="M236 280 L276 280 L286 350 L226 350 Z" fill="#1e293b" />
  </g>
`);

// 3. EV Scooter
icons['ev-scooter'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Wheels -->
    <rect x="236" y="90" width="40" height="80" rx="15" fill="#1e293b" />
    <rect x="236" y="342" width="40" height="80" rx="15" fill="#1e293b" />
    <!-- Body Base -->
    <path d="M216 130 L296 130 L316 200 L296 360 L216 360 L196 200 Z" fill="#f8fafc" />
    <path d="M216 130 L296 130 L316 200 L296 360 L216 360 L196 200 Z" fill="none" stroke="#10b981" stroke-width="4" />
    <!-- Green Accent Lines -->
    <path d="M216 150 L196 200 L216 340 M296 150 L316 200 L296 340" fill="none" stroke="#10b981" stroke-width="6" />
    <!-- Floorboard -->
    <rect x="226" y="210" width="60" height="60" rx="5" fill="#334155" />
    <!-- EV Battery Indicator -->
    <rect x="240" y="225" width="32" height="12" rx="4" fill="#10b981" />
    <rect x="240" y="245" width="32" height="12" rx="4" fill="#10b981" />
    <!-- Handlebars -->
    <rect x="186" y="150" width="140" height="20" rx="10" fill="#f1f5f9" />
    <rect x="186" y="145" width="20" height="30" rx="5" fill="#0f172a" />
    <rect x="306" y="145" width="20" height="30" rx="5" fill="#0f172a" />
    <!-- Headlight -->
    <rect x="240" y="130" width="32" height="16" rx="8" fill="#6ee7b7" />
    <!-- Seat -->
    <path d="M236 280 L276 280 L286 350 L226 350 Z" fill="#1e293b" />
  </g>
`);

// 4. Auto Rickshaw
icons['auto-rickshaw'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Wheels -->
    <rect x="240" y="80" width="32" height="60" rx="10" fill="#1e293b" />
    <rect x="130" y="320" width="32" height="80" rx="10" fill="#1e293b" />
    <rect x="350" y="320" width="32" height="80" rx="10" fill="#1e293b" />
    <!-- Body -->
    <path d="M210 100 L302 100 L350 200 L350 380 L162 380 L162 200 Z" fill="#facc15" />
    <!-- Green Accent Bottom -->
    <path d="M162 350 L350 350 L350 380 L162 380 Z" fill="#16a34a" />
    <!-- Roof / Canvas -->
    <rect x="170" y="170" width="172" height="160" rx="10" fill="#0f172a" />
    <!-- Windshield -->
    <path d="M210 110 L302 110 L330 160 L182 160 Z" fill="#94a3b8" />
    <path d="M220 120 L292 120 L315 150 L197 150 Z" fill="#cbd5e1" />
  </g>
`);

// 5. Car
icons['car'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Mirrors -->
    <rect x="130" y="200" width="30" height="20" rx="5" fill="#94a3b8" />
    <rect x="352" y="200" width="30" height="20" rx="5" fill="#94a3b8" />
    <!-- Body -->
    <rect x="156" y="80" width="200" height="352" rx="40" fill="#f8fafc" />
    <!-- Front Windshield -->
    <path d="M176 160 L336 160 L320 220 L192 220 Z" fill="#334155" />
    <!-- Rear Windshield -->
    <path d="M186 350 L326 350 L310 290 L202 290 Z" fill="#334155" />
    <!-- Roof -->
    <rect x="192" y="220" width="128" height="70" fill="#e2e8f0" />
    <!-- Lights -->
    <rect x="176" y="70" width="40" height="20" rx="10" fill="#fef08a" />
    <rect x="296" y="70" width="40" height="20" rx="10" fill="#fef08a" />
    <rect x="176" y="420" width="40" height="15" rx="5" fill="#ef4444" />
    <rect x="296" y="420" width="40" height="15" rx="5" fill="#ef4444" />
  </g>
`);

// 6. Taxi
icons['taxi'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Mirrors -->
    <rect x="130" y="200" width="30" height="20" rx="5" fill="#facc15" />
    <rect x="352" y="200" width="30" height="20" rx="5" fill="#facc15" />
    <!-- Body -->
    <rect x="156" y="80" width="200" height="352" rx="40" fill="#facc15" />
    <!-- Front Windshield -->
    <path d="M176 160 L336 160 L320 220 L192 220 Z" fill="#334155" />
    <!-- Rear Windshield -->
    <path d="M186 350 L326 350 L310 290 L202 290 Z" fill="#334155" />
    <!-- Roof -->
    <rect x="192" y="220" width="128" height="70" fill="#eab308" />
    <!-- Taxi Sign -->
    <rect x="226" y="240" width="60" height="20" rx="4" fill="#0f172a" />
    <rect x="230" y="244" width="52" height="12" rx="2" fill="#facc15" />
    <!-- Stripe -->
    <rect x="156" y="250" width="36" height="10" fill="#0f172a" />
    <rect x="320" y="250" width="36" height="10" fill="#0f172a" />
  </g>
`);

// 7. Van
icons['van'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Mirrors -->
    <rect x="126" y="160" width="30" height="25" rx="5" fill="#1e293b" />
    <rect x="356" y="160" width="30" height="25" rx="5" fill="#1e293b" />
    <!-- Body Base -->
    <rect x="156" y="60" width="200" height="392" rx="30" fill="#e2e8f0" />
    <!-- Bumper -->
    <rect x="156" y="60" width="200" height="40" rx="20" fill="#cbd5e1" />
    <!-- Front Windshield -->
    <path d="M166 120 L346 120 L330 180 L182 180 Z" fill="#334155" />
    <!-- Roof -->
    <rect x="176" y="180" width="160" height="250" rx="10" fill="#f8fafc" filter="url(#softShadow)" />
    <!-- Roof Ribs -->
    <rect x="200" y="210" width="112" height="8" rx="4" fill="#e2e8f0" />
    <rect x="200" y="250" width="112" height="8" rx="4" fill="#e2e8f0" />
    <rect x="200" y="290" width="112" height="8" rx="4" fill="#e2e8f0" />
    <rect x="200" y="330" width="112" height="8" rx="4" fill="#e2e8f0" />
    <rect x="200" y="370" width="112" height="8" rx="4" fill="#e2e8f0" />
  </g>
`);

// 8. EV Van
icons['ev-van'] = createSvg(`
  <g filter="url(#shadow)">
    <rect x="126" y="160" width="30" height="25" rx="5" fill="#10b981" />
    <rect x="356" y="160" width="30" height="25" rx="5" fill="#10b981" />
    <rect x="156" y="60" width="200" height="392" rx="30" fill="#f0fdf4" />
    <rect x="156" y="60" width="200" height="40" rx="20" fill="#10b981" />
    <path d="M166 120 L346 120 L330 180 L182 180 Z" fill="#1e293b" />
    <rect x="176" y="180" width="160" height="250" rx="10" fill="#ffffff" filter="url(#softShadow)" />
    <!-- EV Plug Icon abstract on roof -->
    <circle cx="256" cy="280" r="30" fill="#d1fae5" />
    <path d="M256 260 L246 285 L266 285 L256 305" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
  </g>
`);

// 9. Pickup
icons['pickup'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Mirrors -->
    <rect x="116" y="150" width="30" height="20" rx="5" fill="#334155" />
    <rect x="366" y="150" width="30" height="20" rx="5" fill="#334155" />
    <!-- Body front -->
    <rect x="146" y="60" width="220" height="150" rx="25" fill="#3b82f6" />
    <!-- Windshield -->
    <path d="M156 120 L356 120 L336 170 L176 170 Z" fill="#1e293b" />
    <!-- Roof -->
    <rect x="166" y="170" width="180" height="50" fill="#2563eb" />
    <!-- Bed -->
    <rect x="146" y="220" width="220" height="220" rx="10" fill="#e2e8f0" />
    <!-- Bed inner -->
    <rect x="160" y="230" width="192" height="190" rx="5" fill="#cbd5e1" filter="url(#softShadow)" />
    <!-- Tailgate -->
    <rect x="146" y="420" width="220" height="20" rx="5" fill="#3b82f6" />
  </g>
`);

// 10. Mini Truck
icons['mini-truck'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Cab -->
    <rect x="146" y="50" width="220" height="140" rx="20" fill="#f8fafc" />
    <!-- Windshield -->
    <path d="M156 90 L356 90 L336 140 L176 140 Z" fill="#334155" />
    <!-- Roof -->
    <rect x="166" y="140" width="180" height="50" fill="#e2e8f0" />
    <!-- Container -->
    <rect x="136" y="190" width="240" height="270" rx="10" fill="#ef4444" />
    <rect x="146" y="200" width="220" height="250" rx="5" fill="#dc2626" />
    <!-- Details -->
    <rect x="180" y="250" width="152" height="150" fill="#b91c1c" />
  </g>
`);

// 11. Truck
icons['truck'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Cab -->
    <rect x="136" y="40" width="240" height="150" rx="25" fill="#ffffff" />
    <!-- Windshield -->
    <path d="M146 90 L366 90 L346 140 L166 140 Z" fill="#1e293b" />
    <!-- Roof Deflector -->
    <rect x="166" y="140" width="180" height="60" rx="10" fill="#f8fafc" />
    <!-- Box -->
    <rect x="116" y="200" width="280" height="280" rx="10" fill="#eab308" />
    <!-- Roof Lines -->
    <rect x="140" y="230" width="232" height="220" fill="#facc15" />
    <!-- Container doors / roof details -->
    <rect x="254" y="220" width="4" height="240" fill="#ca8a04" />
  </g>
`);

// 12. Trailer
icons['trailer'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Tractor Cab -->
    <rect x="156" y="30" width="200" height="150" rx="20" fill="#ef4444" />
    <path d="M166 80 L346 80 L326 130 L186 130 Z" fill="#1e293b" />
    <rect x="186" y="130" width="140" height="40" fill="#dc2626" />
    <!-- Trailer Connection / 5th wheel -->
    <rect x="226" y="180" width="60" height="40" fill="#334155" />
    <!-- Trailer Box -->
    <rect x="116" y="200" width="280" height="290" rx="5" fill="#e2e8f0" />
    <rect x="130" y="215" width="252" height="260" fill="#f8fafc" />
    <!-- Stripes -->
    <rect x="116" y="250" width="14" height="160" fill="#3b82f6" />
    <rect x="382" y="250" width="14" height="160" fill="#3b82f6" />
  </g>
`);

// 13. Tempo
icons['tempo'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Cab -->
    <path d="M186 50 L326 50 L346 120 L346 160 L166 160 L166 120 Z" fill="#facc15" />
    <path d="M196 90 L316 90 L326 130 L186 130 Z" fill="#334155" />
    <rect x="196" y="130" width="120" height="30" fill="#eab308" />
    <!-- Bed -->
    <rect x="166" y="160" width="180" height="260" rx="5" fill="#cbd5e1" />
    <!-- Inside Bed -->
    <rect x="176" y="170" width="160" height="240" fill="#94a3b8" filter="url(#softShadow)" />
    <!-- Frame lines -->
    <rect x="216" y="180" width="10" height="220" fill="#475569" />
    <rect x="286" y="180" width="10" height="220" fill="#475569" />
  </g>
`);

// 14. Loader Auto
icons['loader-auto'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Wheel front -->
    <rect x="240" y="60" width="32" height="50" rx="10" fill="#1e293b" />
    <!-- Wheels back -->
    <rect x="130" y="320" width="32" height="80" rx="10" fill="#1e293b" />
    <rect x="350" y="320" width="32" height="80" rx="10" fill="#1e293b" />
    <!-- Cab -->
    <path d="M210 90 L302 90 L330 180 L182 180 Z" fill="#facc15" />
    <path d="M220 100 L292 100 L310 140 L202 140 Z" fill="#94a3b8" />
    <rect x="192" y="140" width="128" height="40" fill="#0f172a" />
    <!-- Cargo Box -->
    <rect x="162" y="180" width="188" height="200" rx="5" fill="#16a34a" />
    <!-- Cargo Box details -->
    <rect x="172" y="190" width="168" height="180" fill="#15803d" />
  </g>
`);

// 15. Bus
icons['bus'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Mirrors -->
    <rect x="116" y="100" width="30" height="20" rx="5" fill="#1e293b" />
    <rect x="366" y="100" width="30" height="20" rx="5" fill="#1e293b" />
    <!-- Body -->
    <rect x="146" y="40" width="220" height="432" rx="35" fill="#3b82f6" />
    <!-- Front Windshield -->
    <path d="M156 80 L356 80 L336 140 L176 140 Z" fill="#1e293b" />
    <!-- Rear Windshield -->
    <rect x="166" y="440" width="180" height="20" rx="10" fill="#1e293b" />
    <!-- Roof Details -->
    <rect x="176" y="140" width="160" height="300" fill="#bfdbfe" filter="url(#softShadow)" />
    <!-- AC Units -->
    <rect x="206" y="180" width="100" height="60" rx="10" fill="#e2e8f0" />
    <rect x="206" y="320" width="100" height="60" rx="10" fill="#e2e8f0" />
    <!-- Vents -->
    <rect x="226" y="190" width="60" height="8" fill="#94a3b8" />
    <rect x="226" y="210" width="60" height="8" fill="#94a3b8" />
    <rect x="226" y="330" width="60" height="8" fill="#94a3b8" />
    <rect x="226" y="350" width="60" height="8" fill="#94a3b8" />
  </g>
`);

// 16. Crane
icons['crane'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Cab -->
    <rect x="156" y="40" width="200" height="150" rx="20" fill="#facc15" />
    <path d="M166 90 L346 90 L326 140 L186 140 Z" fill="#1e293b" />
    <rect x="186" y="140" width="140" height="40" fill="#eab308" />
    <!-- Base -->
    <rect x="136" y="190" width="240" height="260" rx="10" fill="#334155" />
    <!-- Outriggers -->
    <rect x="96" y="220" width="320" height="20" fill="#1e293b" />
    <rect x="96" y="400" width="320" height="20" fill="#1e293b" />
    <circle cx="96" cy="230" r="16" fill="#facc15" />
    <circle cx="416" cy="230" r="16" fill="#facc15" />
    <circle cx="96" cy="410" r="16" fill="#facc15" />
    <circle cx="416" cy="410" r="16" fill="#facc15" />
    <!-- Turret / Boom Base -->
    <circle cx="256" cy="320" r="60" fill="#facc15" />
    <!-- Boom -->
    <rect x="236" y="60" width="40" height="260" fill="#ca8a04" />
    <!-- Boom details -->
    <rect x="246" y="80" width="20" height="220" fill="#0f172a" opacity="0.5" />
    <!-- Hook block -->
    <rect x="236" y="40" width="40" height="30" rx="5" fill="#1e293b" />
  </g>
`);

// 17. Container Truck
icons['container-truck'] = createSvg(`
  <g filter="url(#shadow)">
    <!-- Cab -->
    <rect x="166" y="30" width="180" height="120" rx="20" fill="#ffffff" />
    <path d="M176 70 L336 70 L316 110 L196 110 Z" fill="#1e293b" />
    <!-- Container Base -->
    <rect x="136" y="160" width="240" height="320" rx="5" fill="#0369a1" />
    <!-- Container Roof -->
    <rect x="146" y="170" width="220" height="300" fill="#0284c7" />
    <!-- Ribs -->
    <path d="
      M 160 170 L 160 470 M 180 170 L 180 470 M 200 170 L 200 470 
      M 220 170 L 220 470 M 240 170 L 240 470 M 260 170 L 260 470 
      M 280 170 L 280 470 M 300 170 L 300 470 M 320 170 L 320 470 
      M 340 170 L 340 470
    " fill="none" stroke="#0ea5e9" stroke-width="6" />
    <rect x="236" y="130" width="40" height="30" fill="#334155" />
  </g>
`);

async function generate() {
  for (const [name, svgContent] of Object.entries(icons)) {
    const svgPath = path.join(svgDir, `${name}.svg`);
    const pngPath = path.join(pngDir, `${name}.png`);
    
    // Write SVG
    fs.writeFileSync(svgPath, svgContent);
    console.log(`Generated ${name}.svg`);
    
    // Convert to PNG
    try {
      await sharp(Buffer.from(svgContent))
        .png()
        .toFile(pngPath);
      console.log(`Generated ${name}.png`);
    } catch (err) {
      console.error(`Failed to convert ${name} to PNG:`, err);
    }
  }
  console.log('All icons generated successfully.');
}

generate();
