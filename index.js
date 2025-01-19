const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const userData = document.getElementById('userData')
const loginDiv = document.getElementById('loginDiv');

loginButton.addEventListener('click', async () => {
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value;
    try {
        const loginInputs = { email, password };
        const token = await getToken(loginInputs);
        const data = await getData(token);
        loadPage(data);
    } catch (err) {
        console.error('Log in error: ', err)
    }
})

logoutButton.addEventListener('click', () => {
    location.reload();
})

async function getToken(loginInputs) {
    try {
        const response = await fetch('https://01.kood.tech/api/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic ' + btoa(`${loginInputs.email}:${loginInputs.password}`),
            },
        });
        if (!response.ok) {
            const err = await response.json();
            alert(err.error);
            throw new Error(`Something went wrong: ${err.message}`);
        }
        loginDiv.style.display = 'none'; // on successful login, hide login section
        return await response.json(); // if loginInputs correct returns the token
    } catch (err) {
        throw err;
    }
}

async function getData(token) {
    const query = `
    query {
        user {
          id
          firstName
          lastName
          email
          auditRatio
        }
      transaction(where: {type: {_eq: "xp"}, 
        object: {type: {_eq: "project"}}},
        order_by: {createdAt: asc}) {
        amount
        createdAt
        object {
          name
        }
      }
      skills: transaction(offset: 0, where: {
        _and: [{type: {_ilike: "%skill%"}}]
      }) {
        type
        amount
        object {
          name
        }
      }
    }`
    try {
        const response = await fetch('https://01.kood.tech/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) {
            const err = await response.json();
            alert(err.error);
            throw new Error(`Something went wrong: ${err.message}`);
        }
        const { data } = await response.json();
        return data;
    } catch (err) {
        alert('Error getting from GraphQL endpoint: ', err);
        throw err;
    }
}

function loadPage(data) {
    document.getElementById('identification').innerHTML = `
    <p> User ID: ${data.user[0].id} <p>
    <p> First name: ${data.user[0].firstName} <p>
    <p> Last name: ${data.user[0].lastName} <p>
    <p> E-mail address: ${data.user[0].email} <p>
    <p> Audit ratio: ${data.user[0].auditRatio} <p>
    `;
    createLineGraph(data)
    createBarGraph(data)
    userData.style.display = 'block'; // on successful login, show user data
}

function createLineGraph(data) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';

    const transactions = data.transaction;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width + margin.left + margin.right);
    svg.setAttribute("height", height + margin.top + margin.bottom);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(g);

    // Parse data
    let cumulativeAmount = 0;
    const parsedData = transactions.map((d) => {
      const date = new Date(d.createdAt);
      cumulativeAmount += d.amount;
      return {
        date,
        cumulativeAmount: cumulativeAmount / 1000, // Convert to kb
        displayDate: `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`,
        info: `${d.object.name} ${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}, xp after task ${cumulativeAmount / 1000}kb`
      };
    });

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(parsedData, d => d.date))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.cumulativeAmount)])
      .nice()
      .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeMonth.every(6))
      .tickFormat(d3.timeFormat("%d.%m.%y"));

    const yAxis = d3.axisLeft(yScale).tickFormat(d => `${d}kb`);

    const xAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    xAxisG.setAttribute("transform", `translate(0, ${height})`);
    g.appendChild(xAxisG);
    d3.select(xAxisG).call(xAxis);

    const yAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.appendChild(yAxisG);
    d3.select(yAxisG).call(yAxis);

    // Line and Area
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.cumulativeAmount));

    const area = d3.area()
      .x(d => xScale(d.date))
      .y0(height)
      .y1(d => yScale(d.cumulativeAmount));

    const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaPath.setAttribute("d", area(parsedData));
    areaPath.setAttribute("fill", "blue");
    areaPath.setAttribute("opacity", "0.1");
    g.appendChild(areaPath);

    const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    linePath.setAttribute("d", line(parsedData));
    linePath.setAttribute("fill", "none");
    linePath.setAttribute("stroke", "blue");
    linePath.setAttribute("stroke-width", "2");
    linePath.setAttribute("opacity", "0.2");
    g.appendChild(linePath);

    // Data points
    const tooltip = document.getElementById('tooltip1');

    parsedData.forEach(d => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", xScale(d.date));
      circle.setAttribute("cy", yScale(d.cumulativeAmount));
      circle.setAttribute("r", "5");
      circle.setAttribute("fill", "blue");
      circle.setAttribute("cursor", "pointer");
      circle.setAttribute("opacity", "0.5");

      circle.addEventListener('mouseover', () => {
        tooltip.style.display = 'block';
        tooltip.innerHTML = d.info;
      });

      circle.addEventListener('mousemove', (event) => {
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
      });

      circle.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
      });

      g.appendChild(circle);
    });

    container.appendChild(svg);
}

function createBarGraph(data) {
    const container = document.getElementById('bar-graph-container');
    container.innerHTML = '';

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width + margin.left + margin.right);
    svg.setAttribute("height", height + margin.top + margin.bottom);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(g);

    // Process data
    const skillMap = {};
    data.skills.forEach(skill => {
      const skillKey = skill.type.replace("skill_", "").toUpperCase();
      if (!skillMap[skillKey]) {
        skillMap[skillKey] = { total: 0, details: [] };
      }
      skillMap[skillKey].total += skill.amount;
      skillMap[skillKey].details.push(`${skill.object.name}: ${skill.amount}`);
    });

    const processedData = Object.entries(skillMap).map(([key, value]) => ({
      skill: key,
      total: value.total,
      details: value.details
    }));

    // Scales
    const xScale = d3.scaleBand()
      .domain(processedData.map(d => d.skill))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.total)])
      .nice()
      .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).tickFormat(d => `${d}`);

    const xAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    xAxisG.setAttribute("transform", `translate(0, ${height})`);
    g.appendChild(xAxisG);
    d3.select(xAxisG).call(xAxis);

    const yAxisG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.appendChild(yAxisG);
    d3.select(yAxisG).call(yAxis);

    // Tooltip
    const tooltip = document.getElementById('tooltip2');

    // Bars
    processedData.forEach(d => {
      const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bar.setAttribute("x", xScale(d.skill));
      bar.setAttribute("y", yScale(d.total));
      bar.setAttribute("width", xScale.bandwidth());
      bar.setAttribute("height", height - yScale(d.total));
      bar.setAttribute("fill", "blue");
      bar.setAttribute("opacity", "0.5");

      bar.addEventListener('mouseover', () => {
        tooltip.style.display = 'block';
        tooltip.innerHTML = d.details.join('<br>');
      });

      bar.addEventListener('mousemove', (event) => {
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
      });

      bar.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
      });

      g.appendChild(bar);
    });

    container.appendChild(svg);
}