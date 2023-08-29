import './App.css';
import hierarchy_data from './data.json';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { useRef, useEffect } from 'react';

const data = { hierarchyData: hierarchy_data }

// Fig parameters
const width = 800,
      radius = 35,
      margin = 60,
      margins = { top: margin, right: margin, bottom: margin, left: margin },
      dx = 100,         // vertical node spacing
      dy = width / 6,  // horizontal node spacing
      strokeWidth = 8,
      arrowWidth = 2.5, // in units of strokeWidth
      gradientEnd = width

const color = d3.scaleSequential([0, 1], d3.interpolateWarm)  // color scheme

// horizontal bezier curve generator
const linkGen = d3.linkHorizontal().x(d => d.y).y(d => d.x)

// Calculates x and y positions of tree 
const tree = d3.tree().nodeSize([dx, dy])

// Create markers for arrowheads
const make_marker = (id, marker_color) => {
  d3.select('defs').append('marker')
    .attr('id', id)
    .attr('viewBox', [ 0, -arrowWidth/2, arrowWidth, arrowWidth])
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('markerWidth', arrowWidth)
    .attr('markerHeight', arrowWidth)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', `M 0 ${arrowWidth/2} L ${arrowWidth} 0 L 0 ${-arrowWidth/2} L ${arrowWidth/10} 0 z ` )
    .attr('stroke-width', 0.1)
    .attr('stroke', 'black')
    .attr('fill', marker_color)
}

// Position nodes
const reposition_nodes = (d) => {
  let childIndex = 0
  let xstart = 50
  if (d.data['Next Degree']) {
    d.x = 0
    //d.x0 = 0
  } else if (d.data['Educational Opportunities']) {
    childIndex = d.parent.children.filter(c => c.data['Educational Opportunities']).findIndex(c => c.id === d.id)
    d.x = xstart + childIndex*0.8*radius
    //d.x0 = (childIndex)*100
    d.y = d.parent.y
    //d.y0 = d.parent.y0
  } else if (d.data['Job Opportunities']) {
    childIndex = d.parent.children.filter(c => c.data['Job Opportunities']).findIndex(c => c.id === d.id)
    //let xstart = -d.parent.children.filter(c => c.data['Job Opportunities']).length*0.8*radius - 0.8*radius
    xstart += xstart/3 + d.parent.children.filter(c => c.data['Educational Opportunities']).length*0.8*radius //+ 0.8*radius
    d.x =  xstart + childIndex*0.8*radius
    d.y = d.parent.y // + 1.5*radius + arrowWidth*strokeWidth + 1
  }
  return d
}

const update = (source, rootNode) => {
  console.log('Updating nodes')
  console.log('Source Node:', source)
  console.log('Root Node:', rootNode)

  const svg = d3.select("svg")
  const gLink = svg.select(".links")
  const gNode = svg.select(".nodes")

  // If the source node has the children hidden, show them
  if (!source.children) source.children = source._children

  // get direct descendants (not all descendants)
  let nodes = rootNode.descendants().reverse();

  // Filter node and links to only include those that are children of source or Degree nodes
  nodes = nodes.filter(n => (n.parent && n.parent.id === source.id) || (n.data['Next Degree'] && n.depth <= source.depth))
  let links = rootNode.links()
  links = links.filter(l => l.source.id === source.id )

  // recalulate tree, add x and y coordinates
  tree(rootNode);
  rootNode.descendants().forEach((d, i) => {
    d = reposition_nodes(d)
  });

  // find top most and bottom most leaf positions
  let left = rootNode;
  let right = rootNode;
  rootNode.eachBefore(node => {
    if (node.x < left.x) left = node;
    if (node.x > right.x) right = node;
  });

  links = links.filter(l => {
    if (l.target.data['Next Degree']) return true
    if (l.target.data['Job Opportunities']) {
      if (l.target.id === l.target.parent.children.filter(c => c.data['Job Opportunities'])[0].id) return true
    }
    if (l.target.data['Educational Opportunities']) {
      if (l.target.id === l.target.parent.children.filter(c => c.data['Educational Opportunities'])[0].id) return true
    }
    return false
   })

  // recompute svg height
  const height = right.x - left.x + margins.top + margins.bottom;
  // trasition svg size and viewbox
  const transition = svg.transition()
    .duration(1000)
    .attr("viewBox", [-margins.left, left.x - margins.top, width, height])
    .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

  // Assign link target ids to links as data. Update with transitions on enter and exit
  const gLinks = gLink.selectAll("path")
    .data(links, d => d.target.id)
    .join(
      enter => enter.append("path")
        .attr("stroke", 'url(#color-gradient)')
        .attr("stroke-opacity", 1)
        .each(d => make_marker(d.target.id, color(d.target.y/gradientEnd)))
        .attr("marker-end", d => `url('#${d.target.id}')`)
        .attr("display", "none") // Getting rid of arrow/links for now
        .attr("stroke-width", d => {
          return d.source.data['Next Degree'] ? strokeWidth : strokeWidth / 2
          //return Math.min(10 * d.target.data.user_count, radius) //* d.user_count//Math.floor(Math.random() * radius + 1);
        })
        .attr("d", linkGen({ source: { x: source.x, y: source.y }, target: { x: source.x, y: source.y } }))
        .call(enter => enter.transition(transition)
          .attr("d", d => {
            const origin = { x: d.source.x, y: d.source.y }
            const target = { 
              x: d.target.data['Next Degree'] ? d.target.x : d.target.x - radius/3 - arrowWidth*strokeWidth,
              y: !d.target.data['Next Degree'] ? d.target.y : d.target.y - 1.5*radius - arrowWidth*strokeWidth }
            return linkGen({ source: origin, target: target })
          })
        ),
      update => update
        .call(update => update.transition(transition)
          //.attr("d", linkGen)
          //.attr("marker-end", "url(#arrow)")
          .attr("d", d => {
            const origin = { x: d.source.x, y: d.source.y }
            const target = { 
              x: d.target.data['Next Degree'] ? d.target.x : d.target.x - radius/3 - arrowWidth*strokeWidth,
              y: !d.target.data['Next Degree'] ? d.target.y : d.target.y - 1.5*radius - arrowWidth*strokeWidth }
            return linkGen({ source: origin, target: target });
          })
        ),
      exit => exit
        .call(exit => exit.transition(transition) // Transition exiting nodes to the parent's new position.  
          .remove()
          .attr("d", d => {
            const o = { x: source.x, y: source.y };
            return linkGen({ source: o, target: o });
          })
        )
    )

    // Add text to links
    gLink.selectAll('text')
      .data(links, d => d.target.id)
      .join(
        enter => enter.insert('text', 'path')   
          .text(d => d.target.data['Next Degree'] ? 'Next Degree:': d.target.data['Job Opportunities'] ? 'Jobs:' : 'Courses:')  
          .attr("x", d => d.target.data['Next Degree'] ? source.y : source.y )
          .attr("y", d => d.target.data['Next Degree'] ? source.x : source.x )
          .attr("text-anchor", "middle")//d._children ? "end" : "start")
          //.attr("transform", d => d.target.data['Next Degree'] ? '' : 'rotate(-90)') 
          .attr("font-family", "georgia")
          .attr("fill", "black")
          .attr("stroke-width", 0.1)
          .attr("opacity", 1)
          .call(enter => enter.transition(transition)
            //.attr("opacity", 1)
            .attr("x", d => d.target.data['Next Degree'] ? d.target.y : d.target.y ) //d._children ? -6 : 6)
            .attr("y", d => d.target.data['Next Degree'] ? d.target.x - radius/2 - 6 : d.target.x - radius/2 )
          ),
        update => update
          .call(update => update.transition(transition)
          //.attr("opacity", 1)
            .attr("x", d => d.target.data['Next Degree'] ? d.target.y : d.target.y ) //d._children ? -6 : 6)
            .attr("y", d => d.target.data['Next Degree'] ? d.target.x - radius/2 - 6: d.target.x - radius/2)
          )
      )
    

    // Assign node ids as data. Update with transitions on enter and exit 
    const gNodes = gNode.selectAll('g')
      .data(nodes, d => d.id)
      .classed('degree', d => d.data['Next Degree'])
      .classed('job', d => d.data['Job Opportunities'])
      .classed('edop', d => d.data['Educational Opportunities'])

    gNodes.join(
      enter => enter.append('g')
        .attr("cursor", d => d.data['Next Degree'] ? "pointer" : "default")
        .attr("pointer-events", d => d.data['Next Degree'] ? "all" : "none")
        .attr("transform", d => `translate(${source.y0},${source.x0})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        //.call(enter => enter.filter(d => d.data['Next Degree']).append("rect")
        .call(enter => enter.append("rect")
          .attr('x', -1.5 * radius)
          .attr('y', d => d.data['Next Degree'] ? -radius/2 : -radius/3)
          .attr('width', 3 * radius)
          .attr('height', d => d.data['Next Degree'] ? radius : radius/1.5)
          .attr("rx", d => d.data['Next Degree'] ? 0 : d.data['Educational Opportunities'] ? radius/5 : radius/3)
          .attr("stroke-width", d => d.data['Next Degree'] ? 2 : 1)
          .attr('stroke', d => color(d.y/gradientEnd))
          .attr("fill", '#f7f7f9') //d => d._children ? "#555" : "#999")sd
        )
        .call(enter => enter.append("text")
          .attr("y", d => d.id.includes('/') ? d.id.split('/')[1].split(' ').length > 1 ? "-0.2em" : "0.3em" : d.id.split(' ').length > 1 ?  "-0.2em" : "0.3em")
          .attr("text-anchor", d => "middle")//d._children ? "end" : "start")
          .attr("font-family", "georgia")
          .text(d => d.id.includes('/') ? d.id.split('/')[1].split(' ')[0] : d.id.split(' ')[0])
        )
        .call(enter => enter.append("text")
          .attr("y", "0.9em")
          .attr("text-anchor", d => "middle")//d._children ? "end" : "start")
          .attr("font-family", "georgia")
          .text(d => d.id.includes('/') ? d.id.split('/')[1].split(' ')[1] : d.id.split(' ')[1])
        )
        .call(enter => enter.transition(transition)
          .attr("transform", d => `translate(${d.y},${d.x})`)
          .attr("fill-opacity", 1)
          .attr("stroke-opacity", d => (d.id === source.id || (d.parent && d.parent.id === source.id)) ? 1 : 0)  
          //.attr("stroke-opacity", 1)
        )
        .on("click", (event, d) => {         // recursively update on click event,  toggle switch for turning children on and off
            d.children = d.children ? null : d._children;
            if (d.depth === 0) { 
              rootNode.children = d.children
            } else {
              rootNode.find(node => node.id === d.id).children = d.children 
            }
            update(d, rootNode);
          })
          .on("mouseover", (event, d) => {
            d3.select(event.target.parentNode).select('rect').transition()
              .duration(100)
              .attr('stroke-width', 3)
              .attr("filter", "url(#dropshadow)")
          })
          .on("mouseout", (event, d) => {
            d3.select(event.target.parentNode).select('rect').transition()
              .duration(100)
              .attr('stroke-width', 2)
              .attr("filter", "none")
          }),
      update => update
        .call(update => update.transition(transition)
          .attr("transform", d => `translate(${d.y},${d.x})`)
          .attr("fill-opacity", 1)
          .attr("stroke-opacity", d => (d.id === source.id || (d.parent && d.parent.id === source.id)) ? 1 : 0)   
        ),
      exit => exit
        .call(exit => exit.transition(transition)
          .remove()   // Transition exiting nodes to the parent's new position.
          .attr("transform", d => `translate(${source.y},${source.x})`)
          .attr("fill-opacity", 0)
          .attr("stroke-opacity", 0)
        )
    )

  // Stash the old positions for transition.
  rootNode.eachBefore(d => {
    // position before next transition equal to current position
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

const drawChart = (data, svgContainerRef) => {
  console.log('Drawing chart')

  let svg = d3.select("svg")

  if (svg.empty()) {
    console.log('No svg element found creating...')
    svg = d3.select(svgContainerRef.current).append("svg")
      .attr("viewBox", [-margins.left, -margins.top, width, dx])
      .style("font", "10px sans-serif")
      .style("user-select", "none")
  } else {
    svg.selectAll('*').remove()
  }

  // Add color gradient
  svg.append("linearGradient")
    .attr("id", "color-gradient")
    .attr("gradientUnits", "userSpaceOnUse")
     .attr("x1", margin.left)
     .attr("y1", 0)
     .attr("x2", gradientEnd)
     .attr("y2", 0)
  .selectAll("stop")
    .data(d3.ticks(0, 1, 10))
  .join("stop")
    .attr("offset", d => d)
    .attr("stop-color", color.interpolator());

  const filter = svg.append("filter")
      .attr("id", "dropshadow")
  filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 4)
      .attr("result", "blur")
  filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 2)
      .attr("dy", 2)
      .attr("result", "offsetBlur");
  const feMerge = filter.append("feMerge")
  feMerge.append("feMergeNode")
      .attr("in", "offsetBlur")
  feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic")

  // Add defs for arrowhead markers
  svg.append('defs')
  
  // group links
  svg.append("g")
    .classed('links', true)
    //.attr("cursor", "pointer")
    //.attr("pointer-events", "all")

  // group nodes
  svg.append('g')
    .classed('nodes', true)
    //.attr("cursor", "pointer")
    //.attr("pointer-events", "all")

  //let selectedCareer = 'Health'
  let selectedCareer = 'Education'
  let hierarchyData = data.hierarchyData.filter(r => r.Career == null || r.Career === selectedCareer)
  console.log(hierarchyData)
  let rootData = d3.stratify()
    .id(d => {
      let id = undefined
      if (d['Next Degree']) id = d['Next Degree'] 
      else if ( d['Job Opportunities']) id = d.Degree + '/' + d['Job Opportunities']
      else if ( d['Educational Opportunities']) id = d.Degree + '/' + d['Educational Opportunities']
      return id
     })
    .parentId(d => d.Degree)
    (hierarchyData)

  // Wrap data in tree attributes and methods
  const rootNode = tree(rootData)

  // Reposition nodes, this has to be done for all 
  // nodes before hiding their children
  rootNode.descendants().forEach(d => {
    d = reposition_nodes(d)
  });
  // add id and child copy for each node
  
  // stash children for transitions
  rootNode.descendants().forEach(n => {
    n._children = n.children 
  })

  let selectedDegree = 'High School' 
  let selectedNode = rootNode.find(node => node.id === selectedDegree)
  selectedNode.descendants().forEach(n => {
    if (n.id === selectedDegree) return
    if(n.depth === 0) return
    n.children = null
  })

  // assign rootNode node position
  rootNode.x0 = 0;
  rootNode.y0 = 0;

  // update chart
  update(selectedNode, rootNode)
}

function App() {
  const svgContainerRef = useRef(null);
  useEffect(() => {
    if (svgContainerRef.current) {
      drawChart(data, svgContainerRef);
    }
  })
  return (
    <div id="svgContainer" ref={svgContainerRef}></div>
  );
}

export default App;
