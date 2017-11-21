import React from 'react';
import Reflux from 'reflux';
import LoginPage from 'react-proxy?name=LoginPage!pages/LoginPage';
import LoadingPage from 'react-proxy?name=LoadingPage!pages/LoadingPage';
import LoggedInPage from 'react-proxy?name=LoggedInPage!pages/LoggedInPage';
import ServerUnavailablePage from 'pages/ServerUnavailablePage';

import StoreProvider from 'injection/StoreProvider';
const SessionStore = StoreProvider.getStore('Session');
const ServerAvailabilityStore = StoreProvider.getStore('ServerAvailability');
const CurrentUserStore = StoreProvider.getStore('CurrentUser');
const NodeConfigurationsStore = StoreProvider.getStore('NodeConfigurations');

import ActionsProvider from 'injection/ActionsProvider';
const SessionActions = ActionsProvider.getActions('Session');

import 'bootstrap/less/bootstrap.less';
import 'font-awesome/css/font-awesome.css';
import 'opensans-npm-webfont';
import 'stylesheets/bootstrap-submenus.less';
import 'toastr/toastr.less';
import 'rickshaw/rickshaw.css';
import 'stylesheets/graylog2.less';

import cookie from 'react-cookies'

import $ from 'jquery';

const AppFacade = React.createClass({
  mixins: [Reflux.connect(NodeConfigurationsStore), Reflux.connect(SessionStore), Reflux.connect(ServerAvailabilityStore), Reflux.connect(CurrentUserStore)],

  getInitialState() {
    return {
      logginingFromUC: false,
      lastError: undefined,
    };
  },

  componentDidMount() {
    this.interval = setInterval(ServerAvailabilityStore.ping, 20000);
    this.ucRenewal = setInterval(this._ucRenewal, 10000);
  },

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.ucRenewal) {
      clearInterval(this.ucRenewal);
    }
  },

  _ucRenewal(){
    if (this.state.configuration){
      if (this.state.sessionId){
        const config = this.state.configuration;
        if(config.enable_uc){
          let ticket;
          ticket = cookie.load('ticket');
          if (!ticket){
            ticket = this._getQueryString('ticket');
          }
          if (ticket){
            const ucAddress = config.uc_address;
            const queryUrl = ucAddress + "renewal";
            $.ajax({
              url: queryUrl,
              data: {ticket:ticket, applicationKey:config.uc_application_key},
              success: (resp) => {
                if (!resp.success) {
                  window.alert("renewal failed, may be another system has signed out from uc. Please sign in again.");
                  this._doLogout();
                }
              },
              error: (info) => {
                console.log("renewal error! info: ",info);
              }
            });
          }else {
            this._doLogout();
          }
        }
      }
    }
  },

  _doLogout(){
    SessionActions.logout.triggerPromise(SessionStore.getSessionId()).then(() => {
      history.pushState(null, Routes.STARTPAGE);
    });
  },

  _getQueryString(name) {
    let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    let r = window.location.search.substr(1).match(reg);
    if (r !== null) return unescape(r[2]);
    return null;
  },

  render() {
    const config = this.state.configuration;

    if (!this.state.server.up) {
      return <ServerUnavailablePage server={this.state.server} />;
    }

    if (!config){
      return <LoadingPage text="We are preparing Graylog for you..." />;
    }

    SessionStore.setConfiguration(config);

    if (!this.state.sessionId) {
      if(config.enable_uc){
        const ucAddress = config.uc_address;
        if (!ucAddress){
          window.alert("[WARN] uc enabled but the address of uc is not defined! Please check the config file.");
        }
        let ticket;
        let ticketInCookie = true;
        ticket = cookie.load('ticket');
        if (!ticket){
          ticketInCookie = false;
          ticket = this._getQueryString('ticket');
        }
        if (!ticket){
          const uc = ucAddress.substr(0,ucAddress.indexOf("/hmac"))+"/hmac/";
          const redirectUri = window.location.href;
          window.location.href = uc + "login?redirect_uri="+redirectUri+"&current_application_key="+config.uc_application_key;
          return <LoadingPage text="Wating for uc login..." />;
        }
        if (!ticketInCookie){
          cookie.save('ticket', ticket, { path: '/' });
        }
        const queryUrl = ucAddress + "query";
        let querySuccess = false;
        let userData;
        $.ajax({
          async: false,
          url: queryUrl,
          data: {ticket:ticket, applicationKey:config.uc_application_key},
          success: (resp) => {
            if (resp.success){
              querySuccess = true;
              userData = eval('(' + resp.data + ')');
            }else {
              querySuccess = false;
              console.log("query from uc failed.");
              cookie.remove("ticket", { path: '/' });
              window.location.href = window.location.origin;
            }
          },
          error: (info) => {
            querySuccess = false;
          }
        });
        if (!querySuccess || !userData){
          const uc = ucAddress.substr(0,ucAddress.indexOf("/hmac"));
          const info = "UC SERVER ERROR! Cannot connect UC server with url: "+ uc + ", and Application key: " + config.uc_application_key;
          return <LoadingPage text={info} />;
        }
        const username = userData.principal;
        const token = ticket;
        const host = document.location.host;
        const email = userData.email;
        if (!username){
          const uc = ucAddress.substr(0,ucAddress.indexOf("/hmac"));
          const info = "UC SERVER ERROR! Cannot get user name from UC server with url: "+ uc + ", and Application key: " + config.uc_application_key;
          return <LoadingPage text={info} />;
        }
        const promise = SessionActions.ucLogin.triggerPromise(username, token, host, email);
        promise.catch((error) => {
          window.alert("Error - the server returned: "+error.additional.status+" - "+error.message);
        });

        return <LoadingPage text="We are preparing Graylog for you..." />;
      }
      return <LoginPage />;
    }
    if (!this.state.currentUser) {
      return <LoadingPage text="We are preparing Graylog for you..." />;
    }
    return <LoggedInPage />;
  },
});

export default AppFacade;
