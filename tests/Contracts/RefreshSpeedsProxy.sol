pragma solidity ^0.5.16;

interface IComptroller {
	function refreshStrikeSpeeds() external;
}

contract RefreshSpeedsProxy {
	constructor(address comptroller) public {
		IComptroller(comptroller).refreshStrikeSpeeds();
	}
}
