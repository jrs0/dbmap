#!/usr/bin/env python
from bs4 import BeautifulSoup
import yaml

def section_xml_to_dict(chapter_xml):
    pass
    
def chapter_xml_to_dict(chapter_xml):

    sections = []
    for section in chapter_xml.find_all("section"):
        sections.append({
            "name": section.get("id")
        })
    
    chapter_dict = {
        "name": chapter.find("name").text,
        "docs": chapter.find("desc").text,
        "categories": sections,
    }
    return chapter_dict

with open('icd10cm_april_2023.xml', 'r') as f:
    data = f.read()

    codes_data = BeautifulSoup(data, "xml")

    for chapter in codes_data.find_all("chapter"):
        print(yaml.dump(chapter_xml_to_dict(chapter)))

    # # Finding all instances of tag
    # # `unique`
    # b_unique = Bs_data.find_all('unique')
    
    # print(b_unique)
    
    # # Using find() to extract attributes
    # # of the first instance of the tag
    # b_name = Bs_data.find('child', {'name':'Frank'})
    
    # print(b_name)
    
    # # Extracting the data stored in a
    # # specific attribute of the
    # # `child` tag
    # value = b_name.get('test')
    
    # print(value)
