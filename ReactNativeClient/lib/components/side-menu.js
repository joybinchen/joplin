const React = require('react'); const Component = React.Component;
const { connect } = require('react-redux');
const SideMenu_ = require('react-native-side-menu').default;
const { Dimensions } = require('react-native');

const deviceScreen = Dimensions.get('window');

class SideMenuComponent extends SideMenu_ {};

const MySideMenu = connect(
	(state) => {
		return {
			edgeHitWidth: deviceScreen.width / 3,
			isOpen: state.showSideMenu,
		};
	}
)(SideMenuComponent)

module.exports = { SideMenu: MySideMenu };