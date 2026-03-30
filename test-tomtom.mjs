const KEY = 'j25fWw4jIe3z3eJpEABlY1VABGg4R9Fp';
const coordStr = "41.3874,2.1686:41.4036,2.1744"; // BCN
const url = `https://api.tomtom.com/routing/1/calculateRoute/${coordStr}/json?key=${KEY}&traffic=true&sectionType=traffic&report=effectiveSettings`;
const res = await fetch(url);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
