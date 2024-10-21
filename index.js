import { config, DynamoDb } from 'aws-sdk';

config.update({
    region: 'us-east-1'
});

// new dynamo client
const dynamoDb = new DynamoDb.DocumentClient();
// new dynamo table
const dynamoDbTable = 'products-inventory';
// path names
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

// lambda function
export async function handler(event){
    console.log('Request event:', event);
    
    // dynamic response
    let response;
    switch(true){
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path === productPath:
            response = await getProduct(event.queryStringParameters.product_id);
            break;
        case event.httpMethod === 'GET' && event.path === productsPath:
            response = await getProducts();
            break;
        case event.httpMethod === 'POST' && event.path === productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === productPath:
            const requestBody = JSON.parse(event.body);
            response = await modifyProduct(requestBody.product_id, requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === productPath:
            response = await deleteProduct(JSON.parse(event.body).product_id);
            break;
        default:
            response = buildResponse(404, '404 not-found');
        }
        return response;
}

// build response function
function buildResponse(statusCode, body){
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

// get only one product method
async function getProduct(product_id){
    const params = {
        TableName: dynamoDbTable,
        Key: {
            'productId': product_id
        }
    };
    return await dynamoDb.get(params).promise().then((response) => {
        return buildResponse(200, response.Item);
    }, (error) => {
        console.error('An error occurred getting a product. Detail:', error);
    });
}

// get all products method
async function getProducts(){
    const params = {
        TableName: dynamoDbTable,
    };
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
        products: allProducts
    };
    return buildResponse(200, body);
}

// scanning all records from db
async function scanDynamoRecords(scanParams, itemArray){
    try {
        const dynamoData = await dynamoDb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if(dynamoData.LastEvaluatedKey){
            scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error){
        console.error('An error occurred in scanDynamoRecords method. Detail:', error);
    }
}

// saving items post method
async function saveProduct(requestBody){
    const params = {
        TableName: dynamoDbTable,
        Item: requestBody
    };
    return await dynamoDb.put(params).promise().then(()=>{
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        };
        return buildResponse(200, body);
    }, (error) => {
        console.error('An error occurred saving item. Detail:', error);
    });
} 

// modifying items put method
async function modifyProduct(product_id, updateKey, updateValue){
    const params = {
        TableName: dynamoDbTable,
        Key: {
            'productId': product_id
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAtributteValues: {
            ':value': updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    };
    return await dynamoDb.update(params).promise().then((response)=>{
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: response
        };
        return buildResponse(200, body);
    }, (error)=>{
        console.error('An error occurred modifying product. Detail:', error);
    });
}


// deleting product method
async function deleteProduct(product_id){
    const params = {
        TableName: dynamoDbTable,
        Key: {
            'productId': product_id
        },
        ReturnValues: 'ALL_OLD'
    };
    return await dynamoDb.delete(params).promise().then((response) => {
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        };
        return buildResponse(200, body);
    }, (error) => {
        console.error('An error occurred deleting a product. Detail:', error);
    });
}
