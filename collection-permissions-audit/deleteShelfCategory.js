  function deleteShelfCategory(categoryId) {
    state.shelfCategories = state.shelfCategories.filter(category => category.id !== categoryId);
    saveShelfCategories(state.shelfCategories);
  }

