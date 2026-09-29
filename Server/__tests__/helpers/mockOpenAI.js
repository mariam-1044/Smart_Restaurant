const defaultRecipeResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        name: 'Test Recipe',
        ingredients: ['ingredient-a', 'ingredient-b'],
        steps: ['step 1', 'step 2'],
        estimated_cost: 5.0,
        suggested_price: 12.0,
        profit_margin: 0.58
      })
    }
  }]
};

function buildOpenAIMock({ recipeResponse, shouldThrow = false, errorMessage = 'OpenAI rate limit exceeded' } = {}) {
  const mockCreate = jest.fn(() => {
    if (shouldThrow) return Promise.reject(new Error(errorMessage));
    return Promise.resolve(recipeResponse || defaultRecipeResponse);
  });
  return { mockCreate };
}

module.exports = { buildOpenAIMock, defaultRecipeResponse };