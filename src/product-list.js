// Product fields:
// - name: Product name shown in email alerts.
// - retailer: Shop name shown in email alerts.
// - url: Product page to fetch.
// - targetPrice: Alert threshold in GBP for the whole pack.
// - drinksPerPack: Number of prepared drinks in the pack. Milk drinks usually
//   use two pods per drink, so calculate this as pods ÷ 2.
// - priceRegex (optional): Regex string whose first capture group is the price.
const products = [
  {
    name: 'Costa Latte (16 pods)',
    retailer: 'Amazon UK',
    url: 'https://www.amazon.co.uk/dp/B00A73JFU4',
    targetPrice: 4.50,
    drinksPerPack: 8,
  },
  {
    name: 'Kenco Americano Smooth (16 pods)',
    retailer: 'Amazon UK',
    url: 'https://www.amazon.co.uk/dp/B003BZT45I',
    targetPrice: 4.00,
    drinksPerPack: 16,
  },
  {
    name: "L'OR Espresso Classique (16 pods)",
    retailer: 'Amazon UK',
    url: 'https://www.amazon.co.uk/dp/B01NH9IRI7',
    targetPrice: 4.25,
    drinksPerPack: 16,
  },
];

return products.map(p => ({ json: p }));
