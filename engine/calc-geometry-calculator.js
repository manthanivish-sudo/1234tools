(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["geometry-calculator"] = {
"title": "Area & Volume Calculator",
"category": "mathematics",
"description": "Area, perimeter, surface area and volume for common 2D and 3D shapes.",
"keywords": ["area calculator","volume calculator","circle area","cylinder volume","surface area calculator","geometry calculator"],
"formula": "circle A = πr²  ·  cylinder V = πr²h  ·  sphere V = 4/3 πr³",
"inputs": [{"key":"shape","label":"Shape","type":"select","options":[{"value":"rectangle","label":"Rectangle"},{"value":"triangle","label":"Triangle"},{"value":"circle","label":"Circle"},{"value":"trapezium","label":"Trapezium"},{"value":"cuboid","label":"Cuboid (box)"},{"value":"cylinder","label":"Cylinder"},{"value":"sphere","label":"Sphere"},{"value":"cone","label":"Cone"}],"default":"circle"},{"key":"a","label":"Length / radius / base","type":"number","default":5,"min":0},{"key":"b","label":"Width / height","type":"number","default":3,"min":0},{"key":"c","label":"Depth / second parallel side","type":"number","default":4,"min":0}],
"compute": ({ shape, a, b, c }) => {
      const A = Math.max(0, Number(a) || 0), B = Math.max(0, Number(b) || 0), C = Math.max(0, Number(c) || 0);
      const P = Math.PI;
      let area = NaN, perimeter = NaN, volume = NaN, surface = NaN, desc = '';

      switch (shape) {
        case 'rectangle':
          area = A * B; perimeter = 2 * (A + B); desc = 'Rectangle: length × width'; break;
        case 'triangle':
          area = 0.5 * A * B; desc = 'Triangle: ½ × base × height'; break;
        case 'circle':
          area = P * A * A; perimeter = 2 * P * A; desc = 'Circle: πr², circumference 2πr'; break;
        case 'trapezium':
          area = 0.5 * (A + C) * B; desc = 'Trapezium: ½ × (a + b) × height'; break;
        case 'cuboid':
          volume = A * B * C; surface = 2 * (A * B + B * C + A * C); area = A * B;
          desc = 'Cuboid: l × w × d'; break;
        case 'cylinder':
          volume = P * A * A * B; surface = 2 * P * A * (A + B); area = P * A * A;
          desc = 'Cylinder: πr²h'; break;
        case 'sphere':
          volume = (4 / 3) * P * A * A * A; surface = 4 * P * A * A;
          desc = 'Sphere: 4/3 πr³, surface 4πr²'; break;
        case 'cone':
          volume = (1 / 3) * P * A * A * B;
          surface = P * A * (A + Math.sqrt(A * A + B * B));
          area = P * A * A; desc = 'Cone: ⅓πr²h'; break;
      }
      return { area, perimeter, volume, surface, desc };
    },
"outputs": [{"key":"area","label":"Area (or base area)","format":"number","primary":true},{"key":"perimeter","label":"Perimeter / circumference","format":"number"},{"key":"volume","label":"Volume","format":"number"},{"key":"surface","label":"Surface area","format":"number"},{"key":"desc","label":"Formula used","format":"text"}],
"filled": (v, r, f) => {
      const a = Number(v.a) || 0, b = Number(v.b) || 0, c = Number(v.c) || 0, u = (x) => f.upto(x, 6);
      switch (v.shape) {
        case 'rectangle': return ['area = ' + u(a) + ' × ' + u(b) + ' = ' + u(r.area), 'perimeter = 2 × (' + u(a) + ' + ' + u(b) + ') = ' + u(r.perimeter)];
        case 'triangle': return ['area = ½ × ' + u(a) + ' × ' + u(b) + ' = ' + u(r.area)];
        case 'circle': return ['area = π × ' + u(a) + '² = ' + u(r.area), 'circumference = 2π × ' + u(a) + ' = ' + u(r.perimeter)];
        case 'trapezium': return ['area = ½ × (' + u(a) + ' + ' + u(c) + ') × ' + u(b) + ' = ' + u(r.area)];
        case 'cuboid': return ['volume = ' + u(a) + ' × ' + u(b) + ' × ' + u(c) + ' = ' + u(r.volume)];
        case 'cylinder': return ['volume = π × ' + u(a) + '² × ' + u(b) + ' = ' + u(r.volume)];
        case 'sphere': return ['volume = 4/3 × π × ' + u(a) + '³ = ' + u(r.volume), 'surface = 4π × ' + u(a) + '² = ' + u(r.surface)];
        case 'cone': return ['volume = ⅓ × π × ' + u(a) + '² × ' + u(b) + ' = ' + u(r.volume)];
        default: return [];
      }
    },
"tips": ["Units are whatever you put in. Enter metres and area comes out in square metres, volume in cubic metres.","Only the inputs relevant to the chosen shape are used — a circle ignores width and depth.","For a triangle the second input is the perpendicular height, not the slanted side length."],
"faq": [{"q":"How do I get litres from a volume?","a":"Work in centimetres and divide the cubic centimetres by 1,000, or work in metres and multiply the cubic metres by 1,000. The volume converter handles it either way."}]
};
})();