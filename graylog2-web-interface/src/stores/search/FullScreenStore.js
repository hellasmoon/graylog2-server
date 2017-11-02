import Reflux from 'reflux';
import ActionsProvider from 'injection/ActionsProvider';
const FullScreenActions = ActionsProvider.getActions('FullScreen');

const FullScreenStore = Reflux.createStore({
  listenables: [FullScreenActions],
  onSetFullScreen: function(fullScreen) {
    this.trigger(fullScreen);
  }
});

export default FullScreenStore;
