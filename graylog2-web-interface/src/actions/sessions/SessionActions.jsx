import Reflux from 'reflux';

const SessionActions = Reflux.createActions({
  login: { asyncResult: true },
  logout: { asyncResult: true },
  validate: { asyncResult: true },
  ucLogin: { asyncResult: true },
});

export default SessionActions;
