const tokenSet = new Set();

function addToken(token) {
  tokenSet.add(token);
}

function hasToken(token) {
  return tokenSet.has(token);
}

function removeToken(token) {
  tokenSet.delete(token);
}

module.exports = {
  addToken,
  hasToken,
  removeToken,
};
