import React from 'react';
import {render} from 'react-dom';


export default class App extends React.Component {

	// Construct a React component with four state properties, one per metric
	constructor(props) {
		super(props);
		var today = new Date();
		var d = today.getDay().toString();
		var m = (today.getMonth() + 1).toString();
		var y = today.getFullYear().toString();
		var todayString = y + '-' + m + '-' + d;
		var beginningString = '2016-01-01';

		this.state = {
			newTrialCount: "X",
			popularBlogPosts: [],
			channels: [],
			channelSum: 0,
			retention: {},
			today: todayString,
			beginning: beginningString
		};
	}

	// Sets of real-time looping interval to run queries every 12 seconds
	componentDidMount() {
		var app = this;
		app.runQueries();
		setInterval(function() {
			app.runQueries();
		}, 12000);
	}

	// Run all queries
	runQueries() {
		console.log("Querying...");
		this.queryNewTrials();
		this.queryBlogs();
		this.queryChannels();
		this.queryRetention();
	}

	// Return a range of dates in JQL format for the previous month
	// Returns a two-item array, with a from and to
	calculateLastMonth() {
		var today = new Date();
		var day = today.getDay();
		var month = (today.getMonth()).toString();
		var year = today.getFullYear();		

		if (month === '0') {	// Prior month to January is December
			month = '12';
		}
		else if (month.length === 1) {
			month = '0' + month;	// Prepend 0 for months under 10
		}

		// Establish final day of month (varies by month)
		var lastDate = 31;
		if (month === '02' && year % 4 === 0) {
			lastDate = 29; // leap Year
		} else if (month === '02') {
			lastDate = 28;
		} else if (month === '04' || month === '06' || month === '09' || month === '11') {
			lastDate = 30;
		}

		var start = year + '-' + month + '-' + '01';
		var end = year + '-' + month + '-' + lastDate;
		return [start, end];
	}

	// Query to accumulate last month's number of new trials set up
	queryNewTrials() {
		var component = this;
		var dateRanges = component.calculateLastMonth();
		var params = {
			start_date: dateRanges[0],
			end_date: dateRanges[1]
		}

		MP.api.jql(function main() {
		  return Events({
		    from_date: params.start_date,
		    to_date:   params.end_date
		  })
		  
		  // Pull only events whose names are "Sign up for Trial"
		  .filter(function(events) {
		    return (events.name === "Sign up for Trial");
		  })
		  
		  // Sum the total number of events
		  .reduce(mixpanel.reducer.count());
		  }, params)

		  // Set the state to reflect the total
		  .done(function(results) {
		  	component.setState({newTrialCount: results[0]});
			//console.log(results[0]);
		});
	}

	// Run queries to gather top blog posts by their name and number of visits
	queryBlogs() {
		var component = this;

		var params = {
			from_date: this.state.beginning,
			to_date: this.state.today
		};

    	MP.api.segment('View Blog', 'Blog Title', {limit: 10}).done(function(results) {
	        $('table-blogs').MPTable({ // create table; try scrolling horizontally over demo below
	            data: results,
	            showPercentages: true,
	            firstColHeader: 'Bleh'
        	})
	    });		

		MP.api.jql(function main() {
		  return Events({
		    from_date: params.from_date,
		    to_date:   params.to_date
		  })
		  
		  .filter(function(events) {
		    return (events.name === "View Blog");
		  })

		  .groupBy(["properties.Blog Title"], mixpanel.reducer.count());
		  }, params)

		.done(function(results) {
			component.setState({popularBlogPosts: results});
		});
	}

	// Query to group events by their campaign source (FB, Twitter, etc)
	queryChannels() {
		var component = this;

		var params = {
			from_date: this.state.beginning,
			to_date: this.state.today
		};

		MP.api.jql(function main() {
		  return Events({
		    from_date: params.from_date,
		    to_date:   params.to_date
		  })
		  .groupBy(["properties.Campaign Source"], mixpanel.reducer.count());
		}, params)

		.done(function(results) {
			// Sort Channels by impact, calculate each channel's percentage impact
			var sortedChannels = [];
			var channelCpy = results;
			while (channelCpy.length > 0) {
				var currentChannel = channelCpy.splice(0, 1)[0];
				if (sortedChannels.length === 0) {
					sortedChannels.push(currentChannel);
					continue;
				}
				// Insertion sort into sorted array
				for (var k = 0; k < sortedChannels.length; k++) {
					if (currentChannel.value > sortedChannels[k].value) {
						sortedChannels.splice(k, 0, currentChannel);
						break;
					}
					else if (k === sortedChannels.length - 1) {
						sortedChannels.push(currentChannel);
						break;
					}
				}
			}
			var total = 0;
			for (var channel of sortedChannels) {
				total += channel.value;
			}
			//console.log('total = ' + total);
			component.setState({channels: sortedChannels,
								channelSum: total
			});

		});
	}

	// Query to get retention, defined as users who have completed a session,
	// and whose total sessions is >= 4
	queryRetention() {
		var component = this;

		var params = {
			from: moment().subtract(21, 'days'),
			to: moment().subtract(2, 'days'),
			unit: 'day',

			//born_event: 'Complete Session',
			where: 'properties["Complete Session Count"] >= 4',
		}

		MP.api.retention('Complete Session', params).done(function(results) {
			//console.log('retention');
			//console.log(results.json);
			component.setState({retention: results});
			$('#table-retention').MPTable({
				data: results.json,
				showPercentages: true,
				firstColHeader: 'Date'
			});
		});
	}

	// Render UI
	render() {

		// Create Blog Table DOM elements
		var blogTableData = [];
		for (var i = this.state.popularBlogPosts.length-1; i >= 0; i--) {
			var blog = this.state.popularBlogPosts[i];
			var blogName = blog["key"][0];
			var blogVisits = blog["value"];
			blogTableData.push(
				<tr>
					<td>{blogName}</td>
					<td>{blogVisits.toLocaleString()}</td>
				</tr>);
		}

		// Turn sorted channels into DOM elements w/ graph & key
		var channelBars = [];
		var channelKeys = [];
		var channelBarColors = ["#27eacc", "#fa5d81", "#b371ea", "#fea200", "#42abff", "#5d27ff"];
		var x = 0;
		for (var channel of this.state.channels) {
			var ratio = (Math.round((channel.value / this.state.channelSum) * 100)).toString();
			var ratioCSS = ratio + "%";

			var barStyle = {
				backgroundColor: channelBarColors[x],
				width: ratioCSS,

			};
			channelBars.push(
				<div className="channel-bar" style={barStyle}></div>
			);

			var keyStyle = {
				backgroundColor: channelBarColors[x],
			};
			channelKeys.push(
				<div className="channel-key-item-wrapper">
					<div className="channel-key-block" style={keyStyle}></div>
					<div className="channel-key-name">{channel.key[0]}</div>
					<div className="channel-key-ratio">({ratioCSS})</div>
				</div>
			);
			x++;
		}

		// Currently unused button to run queries
		//<a href="#" onClick={this.runQueries.bind(this, null)} className="app-query-button">Run Queries</a>

		return (
			<div className="app-wrapper" id="root">
				<div id="retentionModal" className="modaldialogue">
					<div className="modaltext">
						<h2>
							Our retention metric is based on session completion.
							The table displays the number of sessions completed on a given day,
							given the condition that the user completing a session has <i>already</i> completed at least
							three sessions prior. This ensures that activity tracks users who have made accounts,
							and have had consistent enough use of Asana to register repeated activity.
						</h2>
						<h4>
							<a href="#close" title="Close" className="close">X</a>
						</h4>
					</div>
				</div>
				<img className="logo" src="src/assets/asana_logo.png" />
				<h6 className="app-title">Dashboard with Mixpanel</h6>
				<div className="results-wrapper">
					<div className="result">
						<div id="trials">{this.state.newTrialCount.toLocaleString()}<br/>New Trials<br/>Last Month</div>
					</div>
					<div className="result" id="retention-result">
						<div className="table-title">User Retention (<a href="#retentionModal">See Retention Metric</a>)</div>					
						<div id="table-retention"></div>						
					</div>						
					<div className="result">
						<table>
							<caption>Top Blog Posts (Page Hits)</caption>
							<tbody>{blogTableData}</tbody>
						</table>
					</div>				
					<div className="result" id="channel-result">
						<div className="channel-title">Channel Traffic Generation</div>
						<div className="channel-bar-wrapper">
							{channelBars}
						</div>
						<div className="channel-key-wrapper">
							{channelKeys}
						</div>						
					</div>
				</div>
			</div>
		);
	}
}

MP.api.setCredentials('acb6588802b8678c797c1fdc8863bc27');
render(<App />, document.getElementById('root'));
