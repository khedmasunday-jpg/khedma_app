module.exports = (req, res, next) => {
    const deviceId = req.headers['device-id'];
    const user = req.user;

    next();
};
