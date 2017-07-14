module.exports = {
  getRand : function () {
    return (Math.random() * (0xff)) & 0xff;
  }
};
