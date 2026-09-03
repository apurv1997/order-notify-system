function getHealth(req, res) {
  return res.status(200).json({ status: 'ok' });
}

module.exports = { getHealth: getHealth };
