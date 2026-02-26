// Updated server/routes.ts file

// No limits on stock and revenue changes

const stockChangePercent = { min: -Infinity, max: Infinity };
const revenueChangePercent = { min: -Infinity, max: Infinity };

// Example instructions
const instructions = {
    stockChange: {
        description: "Change the stock without limits.",
        range: { min: -Infinity, max: Infinity }
    },
    revenueChange: {
        description: "Change the revenue without limits.",
        range: { min: -Infinity, max: Infinity }
    }
};

export { stockChangePercent, revenueChangePercent, instructions };