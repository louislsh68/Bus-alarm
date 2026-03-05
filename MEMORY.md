## Bus Alarm System - Multi-Operator Support

The bus alarm system now supports multiple Hong Kong bus operators (KMB, Citybus, NWFB) through the BUS_OPERATOR environment variable. The system implements daily route refresh to keep stop data current without local storage.

Key features:
- Daily automatic refresh of route information
- Terminal-based direction selection (using actual terminal names instead of 'inbound'/'outbound')
- Support for KMB (fully functional), Citybus and NWFB (with noted API access challenges)
- Comprehensive error handling for API limitations
- iOS-ready API endpoints

Note: Citybus and NWFB APIs on the eTransport Data Room platform return 422 errors despite documentation suggesting working endpoints. This requires special authentication or access method investigation.

## Development Process

When developing software solutions, it's important to:
1. Test APIs thoroughly in addition to relying on documentation
2. Implement graceful error handling for unexpected API behaviors
3. Provide clear status information about system capabilities
4. Maintain detailed documentation of both working features and known limitations