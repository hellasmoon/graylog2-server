import Reflux from 'reflux';

import Store from 'logic/local-storage/Store';
import URLUtils from 'util/URLUtils';
import ApiRoutes from 'routing/ApiRoutes';
import { Builder } from 'logic/rest/FetchProvider';

import cookie from 'react-cookies'

import $ from 'jquery';

import ActionsProvider from 'injection/ActionsProvider';
const SessionActions = ActionsProvider.getActions('Session');

const SessionStore = Reflux.createStore({
  listenables: [SessionActions],
  sourceUrl: '/system/sessions',
  sessionId: undefined,
  username: undefined,
  validatingSession: false,
  configuration: undefined,

  init() {
    this.validate();
  },
  getInitialState() {
    return this.getSessionInfo();
  },

  login(username, password, host) {
    const builder = new Builder('POST', URLUtils.qualifyUrl(this.sourceUrl))
      .json({ username: username, password: password, host: host });
    const promise = builder.build()
      .then((sessionInfo) => {
        return { sessionId: sessionInfo.session_id, username: username };
      });

    SessionActions.login.promise(promise);
  },
  ucLogin(username, token, host, email) {
    const builder = new Builder("POST", URLUtils.qualifyUrl(this.sourceUrl+"/uc"))
      .json({ username: username, token: token, host: host, email: email});
    const promise = builder.build()
      .then((sessionInfo) => {
        return { sessionId: sessionInfo.session_id, username: username };
      });

    SessionActions.ucLogin.promise(promise);
  },
  logout(sessionId) {
    const promise = new Builder('DELETE', URLUtils.qualifyUrl(`${this.sourceUrl}/${sessionId}`))
      .authenticated()
      .build()
      .then((resp) => {
        if (resp.ok || resp.status === 401) {
          this._removeSession();
        }
      }, this._removeSession);

    SessionActions.logout.promise(promise);
  },

  setConfiguration(configuration){
    this.configuration = configuration;
  },

  validate() {
    console.log("validating...");
    const sessionId = Store.get('sessionId');
    const username = Store.get('username');
    this.validatingSession = true;
    this._propagateState();
    this._validateSession(sessionId)
      .then((response) => {
        if (response.is_valid) {
          return SessionActions.login.completed({
            sessionId: sessionId || response.session_id,
            username: username || response.username,
          });
        }
        this._removeSession();
      })
      .finally(() => {
        this.validatingSession = false;
        this._propagateState();
      });
  },
  _validateSession(sessionId) {
    return new Builder('GET', URLUtils.qualifyUrl(ApiRoutes.SessionsApiController.validate().url))
      .session(sessionId)
      .json()
      .build();
  },

  _getQueryString(name) {
    let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    let r = window.location.search.substr(1).match(reg);
    if (r !== null) return unescape(r[2]);
    return null;
  },

  _removeSession() {
    Store.delete('sessionId');
    Store.delete('username');
    this.sessionId = undefined;
    this.username = undefined;
    if (this.configuration){
      if (this.configuration.enable_uc){
        const ucAddress = this.configuration.uc_address;
        if (ucAddress){
          let ticket;
          ticket = cookie.load('ticket');
          if (!ticket){
            ticket = this._getQueryString('ticket');
          }
          if (ticket){
            const queryUrl = ucAddress + "logout";
            $.ajax({
              async: false,
              url: queryUrl,
              data: {ticket:ticket, applicationKey:this.configuration.uc_application_key},
              success: (resp) => {
              },
              error: (info) => {
                window.alert("logout from uc failed! info: "+info);
                window.location.href = window.location.origin;
              }
            });
          }
        }
        cookie.remove("ticket", { path: '/' });
      }
    }
    this._propagateState();
  },

  _propagateState() {
    this.trigger(this.getSessionInfo());
  },

  loginCompleted(sessionInfo) {
    Store.set('sessionId', sessionInfo.sessionId);
    Store.set('username', sessionInfo.username);
    this.sessionId = sessionInfo.sessionId;
    this.username = sessionInfo.username;
    this._propagateState();
  },

  ucLoginCompleted(sessionInfo) {
    Store.set('sessionId', sessionInfo.sessionId);
    Store.set('username', sessionInfo.username);
    this.sessionId = sessionInfo.sessionId;
    this.username = sessionInfo.username;
    this._propagateState();
  },
  isLoggedIn() {
    return this.sessionId !== undefined && this.sessionId !== null;
  },
  getSessionId() {
    return this.sessionId;
  },
  getSessionInfo() {
    return { sessionId: this.sessionId, username: this.username, validatingSession: this.validatingSession };
  },
});

export default SessionStore;
