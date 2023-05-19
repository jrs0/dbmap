#!/usr/bin/env python

from bs4 import BeautifulSoup


# Reading the data inside the xml
# file to a variable under the name
# data
with open('icd10cm_april_2023.xml', 'r') as f:
    data = f.read()

    bs_data = BeautifulSoup(data, "xml")
    print(bs_data)
    exit()
    
    # Finding all instances of tag
    # `unique`
    b_unique = Bs_data.find_all('unique')
    
    print(b_unique)
    
    # Using find() to extract attributes
    # of the first instance of the tag
    b_name = Bs_data.find('child', {'name':'Frank'})
    
    print(b_name)
    
    # Extracting the data stored in a
    # specific attribute of the
    # `child` tag
    value = b_name.get('test')
    
    print(value)
